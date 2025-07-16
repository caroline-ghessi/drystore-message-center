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
const GROUPING_TIME = 60000; // 60 segundos

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

    // Verifica se a conversa está em modo bot
    const { data: conversation } = await supabase
      .from('conversations')
      .select('status, fallback_mode, phone_number')
      .eq('id', conversationId)
      .single();

    if (!conversation || conversation.fallback_mode || conversation.status !== 'bot_attending') {
      console.log('Conversation not in bot mode, skipping Dify processing');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Conversation not in bot mode' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Adiciona mensagem ao buffer
    await addToBuffer(phoneNumber, messageContent, conversationId, supabase);

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

    // Atualiza conversa com conversation_id do Dify
    await supabase
      .from('conversations')
      .update({
        metadata: {
          dify_conversation_id: difyResponse.conversation_id,
          last_dify_message: difyResponse.message_id
        }
      })
      .eq('id', conversationId);

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
        tokens_used: difyResponse.metadata.usage.total_tokens
      }
    });

    console.log(`Successfully processed message for ${phoneNumber}`);

  } catch (error) {
    console.error('Error processing buffered messages:', error);
    
    // Log de erro
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'dify',
      message: 'Erro ao processar mensagem agrupada',
      details: {
        conversation_id: conversationId,
        phone_number: phoneNumber,
        error: error.message
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
        message: message,
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