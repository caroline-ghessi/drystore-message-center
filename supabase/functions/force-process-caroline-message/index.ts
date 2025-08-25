import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DifyMessage {
  inputs: Record<string, string>;
  query: string;
  response_mode: string;
  conversation_id?: string;
  user: string;
  files?: string[];
}

interface DifyResponse {
  message_id: string;
  conversation_id: string;
  answer: string;
  metadata?: {
    usage?: {
      total_tokens: number;
    };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔧 Processando mensagem da Caroline manualmente...');

    // Buscar mensagem pendente da Caroline
    const { data: queueMessage, error: queueError } = await supabase
      .from('message_queue')
      .select('*')
      .eq('id', '500b1299-e566-4675-951a-defa1da06e4b')
      .single();

    if (queueError || !queueMessage) {
      console.error('❌ Mensagem da Caroline não encontrada:', queueError);
      throw new Error('Mensagem não encontrada');
    }

    console.log('📋 Mensagem encontrada:', queueMessage);

    // Buscar conversa
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', queueMessage.conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('❌ Conversa não encontrada:', convError);
      throw new Error('Conversa não encontrada');
    }

    console.log('💬 Conversa encontrada:', conversation.customer_name);

    // Verificar se está em fallback mode
    if (conversation.fallback_mode || conversation.status === 'sent_to_seller') {
      console.log('⚠️ Conversa em fallback mode ou enviada para vendedor, pulando...');
      return new Response(JSON.stringify({
        success: false,
        message: 'Conversa em fallback mode'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar configuração do Dify
    const { data: integrationData, error: integrationError } = await supabase
      .rpc('get_integration_config_secure', { integration_type_param: 'dify' });

    if (integrationError || !integrationData || integrationData.length === 0) {
      console.error('❌ Erro ao buscar config do Dify:', integrationError);
      throw new Error('Configuração do Dify não encontrada');
    }

    const difyConfig = integrationData[0];
    console.log('🤖 Config do Dify encontrada');

    // Preparar mensagem para o Dify
    const joinedMessage = queueMessage.messages_content.join(' ');
    console.log('📝 Mensagem para o Dify:', joinedMessage);

    const difyApiKey = Deno.env.get('DIFY_API_KEY');
    if (!difyApiKey) {
      throw new Error('DIFY_API_KEY não configurada');
    }

    const difyPayload: DifyMessage = {
      inputs: {},
      query: joinedMessage,
      response_mode: "blocking",
      conversation_id: conversation.metadata?.dify_conversation_id,
      user: `customer_${conversation.phone_number}`
    };

    console.log('🚀 Enviando para Dify...');

    // Enviar para Dify
    const difyResponse = await fetch(`${difyConfig.config.api_base_url}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(difyPayload),
    });

    if (!difyResponse.ok) {
      const error = await difyResponse.text();
      console.error('❌ Erro na resposta do Dify:', error);
      throw new Error(`Dify API error: ${error}`);
    }

    const difyData: DifyResponse = await difyResponse.json();
    console.log('✅ Resposta do Dify recebida:', difyData.answer?.substring(0, 100));

    // Salvar resposta do bot
    const { data: botMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'bot',
        sender_name: 'Drystore Bot',
        content: difyData.answer,
        message_type: 'text',
        delivery_status: 'sent',
        message_source: 'dify'
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ Erro ao salvar mensagem do bot:', messageError);
      throw messageError;
    }

    console.log('💾 Mensagem do bot salva');

    // Atualizar conversa com ID do Dify
    if (difyData.conversation_id && !conversation.metadata?.dify_conversation_id) {
      await supabase
        .from('conversations')
        .update({
          metadata: {
            ...conversation.metadata,
            dify_conversation_id: difyData.conversation_id
          }
        })
        .eq('id', conversation.id);
    }

    // Marcar mensagem como processada
    await supabase
      .from('message_queue')
      .update({
        status: 'sent',
        processed_at: new Date().toISOString()
      })
      .eq('id', queueMessage.id);

    console.log('✅ Mensagem marcada como processada');

    // Enviar via WhatsApp
    console.log('📱 Enviando via WhatsApp...');
    
    const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        phone: conversation.phone_number,
        message: difyData.answer
      }
    });

    if (whatsappError) {
      console.error('❌ Erro ao enviar WhatsApp:', whatsappError);
    } else {
      console.log('✅ Mensagem enviada via WhatsApp');
    }

    // Log de sucesso
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'dify',
        message: 'Mensagem da Caroline processada manualmente',
        details: {
          conversation_id: conversation.id,
          customer_name: conversation.customer_name,
          message_content: joinedMessage,
          bot_response: difyData.answer?.substring(0, 200),
          dify_conversation_id: difyData.conversation_id
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: 'Mensagem da Caroline processada com sucesso',
      details: {
        customer: conversation.customer_name,
        bot_response: difyData.answer,
        whatsapp_sent: !whatsappError
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});