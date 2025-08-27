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
const GROUPING_TIME = 60000; // 1 minuto como especificado nos requisitos

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { conversationId, phoneNumber, messageContent, queueId } = body;

    console.log(`🔄 Processing message for conversation ${conversationId || 'undefined'}, phone ${phoneNumber || 'undefined'}`);

    // Verificações de null/undefined mais robustas
    if (!conversationId) {
      console.error('❌ ConversationId is null or undefined');
      return new Response(JSON.stringify({ 
        error: 'ConversationId is required',
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!phoneNumber) {
      console.error('❌ PhoneNumber is null or undefined');
      return new Response(JSON.stringify({ 
        error: 'PhoneNumber is required',
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!messageContent) {
      console.error('❌ MessageContent is null or undefined');
      return new Response(JSON.stringify({ 
        error: 'MessageContent is required',
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verifica se a conversa está em modo bot com tratamento robusto
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('status, fallback_mode, phone_number, metadata')
      .eq('id', conversationId)
      .single();

    if (convError) {
      console.error('❌ Error fetching conversation:', convError);
      return new Response(JSON.stringify({ 
        error: `Failed to fetch conversation: ${convError.message}`,
        success: false 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!conversation) {
      console.log('❌ Conversation not found');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Conversation not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (conversation.fallback_mode || conversation.status !== 'bot_attending') {
      console.log(`❌ Conversation not in bot mode (status: ${conversation.status}, fallback: ${conversation.fallback_mode})`);
      
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
        message: 'Conversation not in bot mode - skipped' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Adiciona mensagem ao buffer
    await addToBuffer(phoneNumber, messageContent, conversationId, queueId, supabase);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Message added to buffer for processing' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Critical error in dify-process-messages:', error);
    
    return new Response(JSON.stringify({ 
      error: `Critical error: ${error.message}`,
      success: false
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
  
  console.log(`📝 Added message to buffer for ${phoneNumber}. Buffer size: ${buffer?.messages.length || 0}`);
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
    console.log(`🚀 Processing grouped message for ${phoneNumber}: "${groupedMessage.substring(0, 100)}..."`);

    // Busca configuração do Dify com tratamento robusto
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('config, active')
      .eq('type', 'dify')
      .single();

    if (integrationError) {
      throw new Error(`Failed to fetch Dify integration: ${integrationError.message}`);
    }

    if (!integration) {
      throw new Error('Dify integration not found');
    }

    if (!integration.active) {
      throw new Error('Dify integration is not active');
    }

    if (!integration.config?.api_url) {
      throw new Error('Dify integration not properly configured - missing api_url');
    }

    const config = integration.config as { api_url: string };
    const apiKey = Deno.env.get('DIFY_API_KEY');
    
    console.log(`🔑 Dify config: ${config.api_url}, API key: ${apiKey ? 'present' : 'MISSING'}`);
    
    if (!apiKey) {
      throw new Error('DIFY_API_KEY not found in secrets. Please configure it in Supabase dashboard.');
    }

    // Busca conversation_id do Dify se existir
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('metadata')
      .eq('id', conversationId)
      .single();

    // Prepara payload para Dify
    const payload: DifyMessage = {
      inputs: {},
      query: groupedMessage,
      response_mode: 'blocking',
      user: phoneNumber,
    };

    if (existingConversation?.metadata?.dify_conversation_id) {
      payload.conversation_id = existingConversation.metadata.dify_conversation_id;
      console.log(`🔗 Using existing Dify conversation: ${payload.conversation_id}`);
    }

    // Anti-duplicação: verifica se já existe resposta recente
    const { data: recentBotReply } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'bot')
      .gte('created_at', new Date(Date.now() - 30 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentBotReply && recentBotReply.length > 0) {
      console.log(`⏸️ Bot replied recently, skipping to avoid duplication`);
      
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

    // Envia para Dify com timeout e retry
    console.log(`📤 Sending to Dify: ${config.api_url}/chat-messages`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout

    let response;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        response = await fetch(`${config.api_url}/chat-messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        if (response.ok) {
          break; // Sucesso, sai do loop
        } else {
          const errorText = await response.text();
          console.error(`🚫 Dify API error (attempt ${retries + 1}): ${response.status} - ${errorText}`);
          
          if (retries === maxRetries - 1) {
            throw new Error(`Dify API error after ${maxRetries} attempts: ${response.status} - ${errorText}`);
          }
        }
      } catch (error) {
        console.error(`🚫 Network error (attempt ${retries + 1}):`, error);
        
        if (retries === maxRetries - 1) {
          throw new Error(`Network error after ${maxRetries} attempts: ${error.message}`);
        }
      }
      
      retries++;
      // Espera progressivamente mais tempo entre tentativas
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }

    const difyResponse: DifyResponse = await response!.json();
    console.log(`✅ Dify response received: ${difyResponse.answer.substring(0, 100)}...`);

    // Salva resposta do bot no banco
    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'bot',
      sender_name: 'Dify Bot',
      content: difyResponse.answer,
      message_type: 'text',
      delivery_status: 'sent',
      message_source: 'dify',
      metadata: {
        dify_message_id: difyResponse.message_id,
        tokens_used: difyResponse.metadata.usage.total_tokens
      }
    });

    if (messageError) {
      console.error('❌ Error saving bot message:', messageError);
    }

    // Atualiza conversa com conversation_id do Dify
    const currentMetadata = existingConversation?.metadata || {};
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
      message: '✅ Mensagem processada e enviada com sucesso',
      details: {
        conversation_id: conversationId,
        phone_number: phoneNumber,
        message_id: difyResponse.message_id,
        tokens_used: difyResponse.metadata.usage.total_tokens,
        queue_ids: queueIds,
        grouped_messages_count: buffer.messages.length,
        retries_used: retries
      }
    });

    console.log(`✅ Successfully processed and sent message for ${phoneNumber}`);

  } catch (error) {
    console.error('❌ Error processing buffered messages:', error);
    
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
    
    // Log de erro detalhado
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'dify',
      message: '❌ Erro ao processar mensagem agrupada',
      details: {
        conversation_id: conversationId,
        phone_number: phoneNumber,
        error: error.message,
        stack: error.stack,
        queue_ids: queueIds,
        grouped_messages_count: buffer.messages.length
      }
    });
  }
}

async function sendWhatsAppReply(phoneNumber: string, message: string, supabase: any) {
  try {
    console.log(`📱 Sending WhatsApp reply to ${phoneNumber}`);
    
    // Chama a edge function de envio do WhatsApp
    const { data, error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        to: phoneNumber,
        content: message,
        type: 'text'
      }
    });

    if (error) {
      throw new Error(`WhatsApp send error: ${error.message}`);
    }

    console.log(`✅ WhatsApp reply sent successfully to ${phoneNumber}`);
    return data;
  } catch (error) {
    console.error('❌ Error sending WhatsApp reply:', error);
    throw error;
  }
}