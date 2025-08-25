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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting to process pending messages...');

    // Busca mensagens pendentes na fila
    const { data: pendingMessages, error: queueError } = await supabase
      .from('message_queue')
      .select('*')
      .eq('status', 'waiting')
      .lt('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(10); // Processa até 10 mensagens por vez

    if (queueError) {
      throw new Error(`Error fetching pending messages: ${queueError.message}`);
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('No pending messages to process');
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        message: 'No pending messages to process' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${pendingMessages.length} pending messages to process`);

    // Verifica configuração do Dify
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('config, active')
      .eq('type', 'dify')
      .single();

    if (integrationError || !integration) {
      throw new Error(`Dify integration not found: ${integrationError?.message || 'No integration data'}`);
    }

    if (!integration.active) {
      throw new Error('Dify integration is not active');
    }

    const config = integration.config as { api_url: string };
    const apiKey = Deno.env.get('DIFY_API_KEY');
    
    if (!apiKey) {
      throw new Error('DIFY_API_KEY not found in secrets');
    }

    let processedCount = 0;
    let errorCount = 0;

    // Processa cada mensagem pendente
    for (const messageItem of pendingMessages) {
      try {
        // Busca a conversa
        const { data: conversation } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', messageItem.conversation_id)
          .single();

        if (!conversation) {
          console.log(`Conversation ${messageItem.conversation_id} not found, skipping`);
          continue;
        }

        // Verifica se ainda está em modo bot
        if (conversation.fallback_mode || conversation.status !== 'bot_attending') {
          console.log(`Conversation ${messageItem.conversation_id} not in bot mode, marking as processed`);
          
          // Marca como processada (não precisa enviar para Dify)
          await supabase
            .from('message_queue')
            .update({ 
              status: 'skipped',
              processed_at: new Date().toISOString()
            })
            .eq('id', messageItem.id);

          processedCount++;
          continue;
        }

        // Agrupa mensagens
        const groupedMessage = messageItem.messages_content?.join(' ') || '';
        
        if (!groupedMessage.trim()) {
          console.log(`Empty message for conversation ${messageItem.conversation_id}, skipping`);
          continue;
        }

        console.log(`Processing message for conversation ${messageItem.conversation_id}: ${groupedMessage}`);

        // Prepara payload para Dify
        const payload: DifyMessage = {
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
        console.log(`Sending to Dify: ${config.api_url}/chat-messages`);
        
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
          console.error(`Dify API error for conversation ${messageItem.conversation_id}: ${response.status} ${response.statusText} - ${errorText}`);
          
          // Marca como erro na fila
          await supabase
            .from('message_queue')
            .update({ 
              status: 'error',
              processed_at: new Date().toISOString()
            })
            .eq('id', messageItem.id);

          // Log do erro
          await supabase.from('system_logs').insert({
            type: 'error',
            source: 'dify-manual-processing',
            message: 'Erro ao processar mensagem pendente',
            details: {
              conversation_id: messageItem.conversation_id,
              phone_number: conversation.phone_number,
              error: `Dify API error: ${response.status} ${response.statusText} - ${errorText}`,
              queue_item_id: messageItem.id
            }
          });

          errorCount++;
          continue;
        }

        const difyResponse: DifyResponse = await response.json();

        // Salva resposta do bot no banco
        await supabase.from('messages').insert({
          conversation_id: messageItem.conversation_id,
          sender_type: 'bot',
          sender_name: 'Dify Bot',
          content: difyResponse.answer,
          message_type: 'text',
          metadata: {
            dify_message_id: difyResponse.message_id,
            tokens_used: difyResponse.metadata.usage.total_tokens,
            processed_manually: true
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
              last_dify_message: difyResponse.message_id
            }
          })
          .eq('id', messageItem.conversation_id);

        // Envia resposta via WhatsApp
        await sendWhatsAppReply(conversation.phone_number, difyResponse.answer, supabase);

        // Marca como processada na fila
        await supabase
          .from('message_queue')
          .update({ 
            status: 'sent',
            processed_at: new Date().toISOString()
          })
          .eq('id', messageItem.id);

        // Log de sucesso
        await supabase.from('system_logs').insert({
          type: 'info',
          source: 'dify-manual-processing',
          message: 'Mensagem pendente processada com sucesso',
          details: {
            conversation_id: messageItem.conversation_id,
            phone_number: conversation.phone_number,
            message_id: difyResponse.message_id,
            tokens_used: difyResponse.metadata.usage.total_tokens,
            queue_item_id: messageItem.id
          }
        });

        processedCount++;
        console.log(`Successfully processed pending message for conversation ${messageItem.conversation_id}`);

      } catch (error) {
        console.error(`Error processing message for conversation ${messageItem.conversation_id}:`, error);
        
        // Marca como erro na fila
        await supabase
          .from('message_queue')
          .update({ 
            status: 'error',
            processed_at: new Date().toISOString()
          })
          .eq('id', messageItem.id);

        errorCount++;
      }
    }

    const result = {
      success: true,
      processed: processedCount,
      errors: errorCount,
      total_found: pendingMessages.length,
      message: `Processed ${processedCount} messages, ${errorCount} errors`
    };

    console.log('Processing complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-pending-messages:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function sendWhatsAppReply(phoneNumber: string, message: string, supabase: any) {
  try {
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