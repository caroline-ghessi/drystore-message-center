import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Buscar conversas que receberam mensagens hoje mas não foram processadas pelo bot
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Pegar conversas onde:
    // 1. Cliente enviou mensagem hoje
    // 2. Bot não respondeu (não há mensagens do tipo 'bot' ou 'dify' hoje)
    // 3. Status é 'bot_attending' e não está em fallback_mode
    const { data: conversationsToProcess, error: fetchError } = await supabase
      .from('conversations')
      .select(`
        id, customer_name, phone_number, status, fallback_mode,
        messages!inner(
          id, content, sender_type, created_at, message_source
        )
      `)
      .eq('status', 'bot_attending')
      .eq('fallback_mode', false)
      .gte('messages.created_at', today.toISOString())
      .lt('messages.created_at', tomorrow.toISOString())
      .eq('messages.sender_type', 'customer');

    if (fetchError) {
      console.error('Erro ao buscar conversas:', fetchError);
      throw fetchError;
    }

    console.log(`Encontradas ${conversationsToProcess?.length || 0} conversas para verificar`);

    let processedConversations = 0;
    let messagesQueued = 0;

    for (const conversation of conversationsToProcess || []) {
      // Verificar se bot já respondeu hoje
      const { data: botMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversation.id)
        .in('sender_type', ['bot'])
        .in('message_source', ['dify'])
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      // Se bot já respondeu, pular
      if (botMessages && botMessages.length > 0) {
        continue;
      }

      // Buscar mensagens do cliente hoje para agrupar
      const { data: customerMessages, error: messagesError } = await supabase
        .from('messages')
        .select('content')
        .eq('conversation_id', conversation.id)
        .eq('sender_type', 'customer')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error(`Erro ao buscar mensagens da conversa ${conversation.id}:`, messagesError);
        continue;
      }

      if (!customerMessages || customerMessages.length === 0) {
        continue;
      }

      // Agrupar mensagens do cliente
      const groupedContent = customerMessages
        .map(m => m.content)
        .filter(Boolean)
        .join('\n');

      if (!groupedContent.trim()) {
        continue;
      }

      // Adicionar à fila de processamento
      const { error: queueError } = await supabase
        .from('message_queue')
        .insert({
          conversation_id: conversation.id,
          messages_content: [groupedContent],
          status: 'waiting',
          scheduled_for: new Date().toISOString(), // Processar imediatamente
          retry_count: 0
        });

      if (queueError) {
        console.error(`Erro ao adicionar à fila conversa ${conversation.id}:`, queueError);
        continue;
      }

      processedConversations++;
      messagesQueued++;

      console.log(`Conversa ${conversation.id} (${conversation.customer_name}) adicionada à fila`);
    }

    // Log do resultado
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'dify',
      message: 'Reprocessamento de mensagens de hoje executado',
      details: {
        conversations_processed: processedConversations,
        messages_queued: messagesQueued,
        executed_at: new Date().toISOString()
      }
    });

    console.log(`Reprocessamento concluído: ${processedConversations} conversas, ${messagesQueued} mensagens na fila`);

    return new Response(JSON.stringify({
      success: true,
      message: `Reprocessamento concluído com sucesso`,
      conversations_processed: processedConversations,
      messages_queued: messagesQueued
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro no reprocessamento:', error);
    
    // Log do erro
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'dify',
      message: 'Erro no reprocessamento de mensagens',
      details: {
        error: error.message,
        stack: error.stack,
        executed_at: new Date().toISOString()
      }
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});