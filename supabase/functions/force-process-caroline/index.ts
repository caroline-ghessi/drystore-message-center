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

    console.log('🎯 Processando mensagem específica da Caroline...');

    // Busca a mensagem específica da Caroline
    const { data: queueItem, error: queueError } = await supabase
      .from('message_queue')
      .select('*')
      .eq('conversation_id', '84d7feb6-c046-41f8-95d5-d678f4f4aa4b')
      .eq('status', 'waiting')
      .single();

    if (queueError || !queueItem) {
      console.log('❌ Mensagem da Caroline não encontrada na fila');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Queue item not found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📨 Encontrada mensagem da fila:', queueItem);

    // Busca a conversa
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', queueItem.conversation_id)
      .single();

    if (!conversation) {
      console.log('❌ Conversa não encontrada');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Conversation not found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verifica configuração do Dify
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('config, active')
      .eq('type', 'dify')
      .single();

    if (integrationError || !integration) {
      throw new Error(`Dify integration not found: ${integrationError?.message || 'No integration data'}`);
    }

    const config = integration.config as { api_url: string };
    const apiKey = Deno.env.get('DIFY_API_KEY');
    
    if (!apiKey) {
      throw new Error('DIFY_API_KEY not found in secrets');
    }

    // Agrupa as mensagens da fila
    const groupedMessage = queueItem.messages_content?.join('\n') || '';
    
    console.log(`💬 Enviando mensagem para Dify: "${groupedMessage}"`);

    // Prepara payload para Dify
    const payload = {
      inputs: {},
      query: groupedMessage,
      response_mode: 'blocking',
      user: conversation.phone_number,
    };

    // Busca conversation_id do Dify se existir
    if (conversation.metadata?.dify_conversation_id) {
      payload.conversation_id = conversation.metadata.dify_conversation_id;
    }

    // Envia para Dify
    const response = await fetch(`${config.api_url}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro na API do Dify: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`Dify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const difyResponse = await response.json();
    console.log(`✅ Resposta recebida do Dify: "${difyResponse.answer.substring(0, 100)}..."`);

    // Salva resposta do bot no banco
    await supabase.from('messages').insert({
      conversation_id: queueItem.conversation_id,
      sender_type: 'bot',
      sender_name: 'Dify Bot',
      content: difyResponse.answer,
      message_type: 'text',
      metadata: {
        dify_message_id: difyResponse.message_id,
        tokens_used: difyResponse.metadata.usage.total_tokens,
        processed_manually: true,
        queue_item_id: queueItem.id
      }
    });

    // Atualiza conversa com conversation_id do Dify
    const currentMetadata = conversation.metadata || {};
    await supabase
      .from('conversations')
      .update({
        metadata: {
          ...currentMetadata,
          dify_conversation_id: difyResponse.conversation_id,
          last_dify_message: difyResponse.message_id,
          last_processed_at: new Date().toISOString()
        }
      })
      .eq('id', queueItem.conversation_id);

    // Envia resposta via WhatsApp
    console.log(`📱 Enviando resposta via WhatsApp para ${conversation.phone_number}`);
    
    const { data: whatsappData, error: whatsappError } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        to: conversation.phone_number,
        content: difyResponse.answer,
        type: 'text'
      }
    });

    if (whatsappError) {
      console.error('❌ Erro ao enviar WhatsApp:', whatsappError);
    } else {
      console.log('✅ WhatsApp enviado com sucesso');
    }

    // Marca como processado na fila
    await supabase
      .from('message_queue')
      .update({ 
        status: 'sent',
        processed_at: new Date().toISOString()
      })
      .eq('id', queueItem.id);

    // Log de sucesso
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'manual_processor',
      message: 'Mensagem da Caroline processada manualmente com sucesso',
      details: {
        conversation_id: queueItem.conversation_id,
        phone_number: conversation.phone_number,
        message_id: difyResponse.message_id,
        tokens_used: difyResponse.metadata.usage.total_tokens,
        queue_item_id: queueItem.id
      }
    });

    console.log('🎯 Processamento manual concluído com sucesso!');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Caroline message processed successfully',
      dify_response: difyResponse.answer.substring(0, 200),
      whatsapp_sent: !whatsappError
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no processamento manual:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});