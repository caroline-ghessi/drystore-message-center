import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DifyMessage {
  inputs: Record<string, any>;
  query: string;
  response_mode: 'blocking';
  conversation_id?: string;
  user: string;
}

interface DifyResponse {
  message_id: string;
  conversation_id: string;
  mode: string;
  answer: string;
  metadata: {
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
  created_at: number;
}

// Message buffer para agrupar mensagens
const messageBuffer = new Map<string, { messages: string[], timer: number }>();
const GROUPING_TIME = 60000; // 60 segundos para agrupamento adequado

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { conversationId, phoneNumber, messageContent } = await req.json();

    console.log(`Processing message for conversation ${conversationId}, phone ${phoneNumber}`);
    console.log(`🤖 FASE 1: Recebida mensagem para processamento bot`);
    console.log(`📋 Detalhes: conversa=${conversationId}, telefone=${phoneNumber}, conteúdo="${messageContent.substring(0, 50)}..."`);

    // Verifica se a conversa está em modo bot
    const { data: conversation } = await supabase
      .from('conversations')
      .select('status, fallback_mode, phone_number, metadata')
      .eq('id', conversationId)
      .single();

    if (!conversation || conversation.fallback_mode || conversation.status !== 'bot_attending') {
      console.log(`❌ FASE 1: Conversa não elegível para bot`);
      console.log(`📋 Status: existe=${!!conversation}, fallback=${conversation?.fallback_mode}, status=${conversation?.status}`);
      console.log('Conversation not in bot mode, skipping Dify processing');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Conversation not in bot mode' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ FASE 1: Conversa elegível para processamento bot`);

    // Adiciona mensagem ao buffer
    console.log(`🔄 FASE 2: Adicionando mensagem ao buffer (agrupamento de 60s)`);
    await addToBuffer(phoneNumber, messageContent, conversationId, supabase);

    return new Response(JSON.stringify({ 
      success: true,
      message: '✅ FASE 2: Message added to buffer for 60s grouping' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in dify-process-messages:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function addToBuffer(
  phoneNumber: string, 
  message: string, 
  conversationId: string,
  supabase: any
) {
  const existing = messageBuffer.get(phoneNumber);
  
  if (existing) {
    existing.messages.push(message);
    // Cancela timer anterior
    clearTimeout(existing.timer);
  } else {
    messageBuffer.set(phoneNumber, {
      messages: [message],
      timer: 0
    });
  }

  // Agenda processamento
  const timer = setTimeout(() => {
    processBufferedMessages(phoneNumber, conversationId, supabase);
  }, GROUPING_TIME);

  const buffer = messageBuffer.get(phoneNumber);
  if (buffer) {
    buffer.timer = timer;
  }
}

async function processBufferedMessages(
  phoneNumber: string, 
  conversationId: string,
  supabase: any
) {
  const buffer = messageBuffer.get(phoneNumber);
  if (!buffer || buffer.messages.length === 0) return;

  // Remove do buffer
  messageBuffer.delete(phoneNumber);

  // Agrupa mensagens
  const groupedMessage = buffer.messages.join(' ');

  try {
    console.log(`🚀 FASE 3: Processando mensagens agrupadas para ${phoneNumber}`);
    console.log(`📨 Total de mensagens agrupadas: ${buffer.messages.length}`);
    console.log(`💬 Conteúdo agrupado: "${groupedMessage.substring(0, 100)}..."`);

    // Busca configuração do Dify
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('config, active')
      .eq('type', 'dify')
      .single();

    console.log('Dify integration found:', integration);

    if (integrationError || !integration) {
      throw new Error(`Dify integration not found: ${integrationError?.message || 'No integration data'}`);
    }

    if (!integration.active) {
      throw new Error('Dify integration is not active');
    }

    if (!integration.config?.api_url) {
      throw new Error('Dify integration not properly configured - missing api_url');
    }

    const config = integration.config as { api_url: string };
    const apiKey = Deno.env.get('DIFY_API_KEY');
    
    console.log('Dify config:', { api_url: config.api_url, has_api_key: !!apiKey });
    
    if (!apiKey) {
      throw new Error('DIFY_API_KEY not found in secrets. Please configure it in Supabase dashboard.');
    }

    // Prepara payload para Dify
    const payload: DifyMessage = {
      inputs: {},
      query: groupedMessage,
      response_mode: 'blocking',
      user: phoneNumber,
    };

    // Busca conversation_id do Dify se existir
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('metadata')
      .eq('id', conversationId)
      .single();

    if (existingConversation?.metadata?.dify_conversation_id) {
      payload.conversation_id = existingConversation.metadata.dify_conversation_id;
    }

    // Envia para Dify
    console.log(`Sending to Dify: ${config.api_url}/chat-messages`);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
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
      console.error(`Dify API error: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`Dify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const difyResponse: DifyResponse = await response.json();

    // Salva resposta do bot no banco
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'bot',
      sender_name: 'Dify Bot',
      content: difyResponse.answer,
      message_type: 'text',
      metadata: {
        dify_message_id: difyResponse.message_id,
        tokens_used: difyResponse.metadata.usage.total_tokens
      }
    });

    // Atualiza conversa com conversation_id do Dify preservando metadata existente
    const currentMetadata = existingConversation?.metadata || {};
    await supabase
      .from('conversations')
      .update({
        metadata: {
          ...currentMetadata,
          dify_conversation_id: difyResponse.conversation_id,
          last_dify_message: difyResponse.message_id
        }
      })
      .eq('id', conversationId);

    // Envia resposta via WhatsApp (com possível conversão para áudio)
    await sendWhatsAppReply(phoneNumber, difyResponse.answer, conversationId, supabase);

    // Log de sucesso com detalhes específicos do bot
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'dify_bot_flow',
      message: '✅ FLUXO BOT: Mensagem processada e enviada com sucesso',
      details: {
        conversation_id: conversationId,
        phone_number: phoneNumber,
        message_id: difyResponse.message_id,
        tokens_used: difyResponse.metadata.usage.total_tokens,
        grouped_messages_count: buffer.messages.length,
        grouping_time_seconds: 60,
        dify_conversation_id: difyResponse.conversation_id,
        processing_flow: 'customer_message -> 60s_grouping -> dify_processing -> whatsapp_send'
      }
    });

    console.log(`🎯 FASE 5: Fluxo bot concluído com sucesso para ${phoneNumber}`);

  } catch (error) {
    console.error('Error processing buffered messages:', error);
    
    // Log de erro com detalhes específicos do bot
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'dify_bot_flow',
      message: '❌ FLUXO BOT: Erro ao processar mensagem agrupada',
      details: {
        conversation_id: conversationId,
        phone_number: phoneNumber,
        error: error.message,
        grouped_messages_count: buffer?.messages.length || 0,
        processing_stage: 'message_grouping_or_dify_processing'
      }
    });
  }
}

async function sendWhatsAppReply(phoneNumber: string, message: string, conversationId: string, supabase: any) {
  try {
    // Verificar se a conversa tem áudio habilitado
    const { data: conversation } = await supabase
      .from('conversations')
      .select('audio_enabled, preferred_voice')
      .eq('id', conversationId)
      .single();

    let audioBase64 = null;
    
    // Se áudio estiver habilitado, converter texto para áudio
    if (conversation?.audio_enabled) {
      try {
        console.log('Convertendo resposta do bot para áudio...');
        
        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-text-to-speech', {
          body: {
            text: message,
            voiceId: conversation.preferred_voice,
            conversationId
          }
        });

        if (ttsError) {
          console.error('Erro na síntese de voz:', ttsError);
        } else if (ttsData?.success) {
          audioBase64 = ttsData.audioBase64;
          console.log('Áudio gerado com sucesso');
        }
      } catch (error) {
        console.error('Erro ao processar TTS:', error);
        // Continua com texto se houver erro na síntese
      }
    }

    // Chama a edge function de envio do WhatsApp
    const { data, error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        to: phoneNumber,
        content: message,
        type: audioBase64 ? 'audio' : 'text',
        audioBase64: audioBase64,
        conversationId
      }
    });

    if (error) {
      console.error('❌ Erro retornado pela função whatsapp-send:', error);
      throw new Error(`WhatsApp send error: ${error.message || JSON.stringify(error)}`);
    }

    if (!data?.success) {
      throw new Error(`WhatsApp send failed: ${data?.error || 'Unknown error'}`);
    }

    console.log(`WhatsApp reply sent to ${phoneNumber} ${audioBase64 ? '(as audio)' : '(as text)'}`);
  } catch (error) {
    console.error('Error sending WhatsApp reply:', error);
    throw error;
  }
}