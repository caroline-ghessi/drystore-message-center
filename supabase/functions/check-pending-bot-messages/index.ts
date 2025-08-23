import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Verificando mensagens do bot que podem não ter sido enviadas...');

    // Buscar conversas que estão em bot_attending e têm mensagens do bot recentes
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        phone_number,
        customer_name,
        status,
        fallback_mode,
        created_at
      `)
      .eq('status', 'bot_attending')
      .eq('fallback_mode', false)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Últimas 24 horas

    if (convError) {
      throw new Error(`Erro ao buscar conversas: ${convError.message}`);
    }

    console.log(`📋 Encontradas ${conversations?.length || 0} conversas ativas do bot`);

    const results = [];

    if (conversations && conversations.length > 0) {
      for (const conversation of conversations) {
        // Buscar mensagens do bot para esta conversa
        const { data: botMessages, error: msgError } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            metadata,
            whatsapp_message_id
          `)
          .eq('conversation_id', conversation.id)
          .eq('sender_type', 'bot')
          .order('created_at', { ascending: false })
          .limit(5);

        if (msgError) {
          console.error(`❌ Erro ao buscar mensagens da conversa ${conversation.id}:`, msgError);
          continue;
        }

        // Verificar se há mensagens do bot sem whatsapp_message_id (podem não ter sido enviadas)
        const unsentMessages = botMessages?.filter(msg => 
          !msg.whatsapp_message_id && 
          !msg.metadata?.whatsapp_sent &&
          !msg.metadata?.whatsapp_message_id
        ) || [];

        if (unsentMessages.length > 0) {
          results.push({
            conversation: {
              id: conversation.id,
              phone_number: conversation.phone_number,
              customer_name: conversation.customer_name,
              status: conversation.status
            },
            unsent_messages: unsentMessages.map(msg => ({
              id: msg.id,
              content: msg.content.substring(0, 100) + '...',
              created_at: msg.created_at,
              metadata: msg.metadata
            }))
          });

          console.log(`⚠️ Conversa ${conversation.id} (${conversation.customer_name || conversation.phone_number}) tem ${unsentMessages.length} mensagens não enviadas`);
        }
      }
    }

    // Verificar também fila de mensagens pendentes
    const { data: queueMessages, error: queueError } = await supabase
      .from('message_queue')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(20);

    if (queueError) {
      console.error(`❌ Erro ao verificar fila de mensagens:`, queueError);
    }

    const summary = {
      conversations_with_unsent_messages: results.length,
      total_unsent_messages: results.reduce((sum, conv) => sum + conv.unsent_messages.length, 0),
      pending_queue_messages: queueMessages?.length || 0,
      results: results,
      queue_messages: queueMessages
    };

    console.log('📊 Resumo da verificação:', {
      conversations_with_unsent: summary.conversations_with_unsent_messages,
      total_unsent: summary.total_unsent_messages,
      pending_queue: summary.pending_queue_messages
    });

    // Log da verificação
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'check_pending_bot_messages',
      message: 'Verificação de mensagens pendentes do bot',
      details: summary
    });

    return new Response(JSON.stringify({
      success: true,
      summary: summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro na verificação de mensagens pendentes:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,  
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});