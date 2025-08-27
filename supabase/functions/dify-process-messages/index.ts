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
const messageBuffer = new Map<string, { messages: string[], timer: number, queueIds: string[] }>();
const GROUPING_TIME = 8000; // 8 segundos - mais responsivo para evitar travamentos

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { conversationId, phoneNumber, messageContent, queueId } = await req.json();

    console.log(`Processing message for conversation ${conversationId}, phone ${phoneNumber}`);

    // Verifica se a conversa está em modo bot
    const { data: conversation } = await supabase
      .from('conversations')
      .select('status, fallback_mode, phone_number, metadata')
      .eq('id', conversationId)
      .single();

    if (!conversation || conversation.fallback_mode || conversation.status !== 'bot_attending') {
      console.log('Conversation not in bot mode, skipping Dify processing');
      
      // Marca mensagem da fila como processada se vier de lá
      if (queueId) {
        await supabase
          .from('message_queue')
          .update({ 
            status: 'skipped',
            processed_at: new Date().toISOString()
          })
          .eq('id', queueId);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Conversation not in bot mode' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Adiciona mensagem ao buffer
    await addToBuffer(phoneNumber, messageContent, conversationId, queueId, supabase);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Message added to buffer' 
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
  queueId: string | null,
  supabase: any
) {
  const existing = messageBuffer.get(phoneNumber);
  
  if (existing) {
    existing.messages.push(message);
    if (queueId) existing.queueIds.push(queueId);
    // Cancela timer anterior
    clearTimeout(existing.timer);
  } else {
    messageBuffer.set(phoneNumber, {
      messages: [message],
      queueIds: queueId ? [queueId] : [],
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
  const queueIds = buffer.queueIds;

  try {
    console.log(`Processing grouped message for ${phoneNumber}: ${groupedMessage}`);

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

    // 🔒 PROTEÇÃO ANTI-DUPLICAÇÃO OTIMIZADA 🔒
    
    // 1. Verifica se já existe resposta do bot muito recente (últimos 30 segundos apenas)
    const { data: recentBotReply } = await supabase
      .from('messages')
      .select('id, created_at, content')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'bot')
      .gte('created_at', new Date(Date.now() - 30 * 1000).toISOString()) // apenas 30 segundos
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentBotReply.length > 0) {
      console.log(`❌ Bot já respondeu há menos de 30s para ${phoneNumber}, aguardando`);
      
      // Marca mensagens da fila como processadas (evita reprocessamento)
      if (queueIds.length > 0) {
        await supabase
          .from('message_queue')
          .update({ 
            status: 'skipped',
            processed_at: new Date().toISOString()
          })
          .in('id', queueIds);
      }

      // Log da prevenção (só para casos extremos)
      await supabase.from('system_logs').insert({
        type: 'info',
        source: 'dify',
        message: 'Bot já respondeu há menos de 30 segundos - aguardando',
        details: {
          conversation_id: conversationId,
          phone_number: phoneNumber,
          recent_bot_message_id: recentBotReply[0].id,
          recent_bot_created_at: recentBotReply[0].created_at,
          time_since_last_bot: Math.floor((Date.now() - new Date(recentBotReply[0].created_at).getTime()) / 1000)
        }
      });
      
      return;
    }

    // 2. Sistema de Lock simplificado - apenas para processos simultâneos (30 segundos)
    const { data: existingLock } = await supabase
      .from('system_logs')
      .select('id, created_at')
      .eq('source', 'dify')
      .eq('message', 'Processamento em andamento')
      .gte('created_at', new Date(Date.now() - 30 * 1000).toISOString()) // lock válido por apenas 30 segundos
      .like('details', `%${conversationId}%`)
      .limit(1);

    if (existingLock.length > 0) {
      console.log(`🔒 Processamento simultâneo detectado para conversa ${conversationId}, aguardando`);
      
      // Marca mensagens da fila como processadas (evita loop)
      if (queueIds.length > 0) {
        await supabase
          .from('message_queue')
          .update({ 
            status: 'skipped',
            processed_at: new Date().toISOString()
          })
          .in('id', queueIds);
      }
      
      return;
    }

    // 3. Cria lock de processamento (mais curto)
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'dify',
      message: 'Processamento em andamento',
      details: {
        conversation_id: conversationId,
        phone_number: phoneNumber,
        lock_created_at: new Date().toISOString(),
        grouped_message: groupedMessage.substring(0, 100) + '...', // só primeiros 100 chars para log
        queue_ids: queueIds
      }
    });

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

    // Marca mensagens da fila como processadas
    if (queueIds.length > 0) {
      await supabase
        .from('message_queue')
        .update({ 
          status: 'sent',
          processed_at: new Date().toISOString()
        })
        .in('id', queueIds);
    }

    // Envia resposta via WhatsApp
    await sendWhatsAppReply(phoneNumber, difyResponse.answer, supabase);

    // Log de sucesso
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'dify',
      message: 'Mensagem processada e enviada com sucesso',
      details: {
        conversation_id: conversationId,
        phone_number: phoneNumber,
        message_id: difyResponse.message_id,
        tokens_used: difyResponse.metadata.usage.total_tokens,
        queue_ids: queueIds,
        buffer_used: true
      }
    });

    console.log(`Successfully processed message for ${phoneNumber}`);

  } catch (error) {
    console.error('Error processing buffered messages:', error);
    
    // Marca mensagens da fila como erro
    if (queueIds.length > 0) {
      await supabase
        .from('message_queue')
        .update({ 
          status: 'error',
          processed_at: new Date().toISOString()
        })
        .in('id', queueIds);
    }
    
    // Log de erro
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'dify',
      message: 'Erro ao processar mensagem agrupada',
      details: {
        conversation_id: conversationId,
        phone_number: phoneNumber,
        error: error.message,
        queue_ids: queueIds
      }
    });
  }
}

async function sendWhatsAppReply(phoneNumber: string, message: string, supabase: any) {
  try {
    // Chama a edge function de envio do WhatsApp
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        to: phoneNumber,
        content: message,
        type: 'text'
      }
    });

    if (error) {
      throw error;
    }

    console.log(`WhatsApp reply sent to ${phoneNumber}`);
  } catch (error) {
    console.error('Error sending WhatsApp reply:', error);
    throw error;
  }
}