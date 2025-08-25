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

    console.log('🤖 Processando fila de mensagens...');

    // Debug: Log do horário atual e fuso horário
    const now = new Date();
    console.log(`⏰ Horário atual: ${now.toISOString()} (UTC)`);
    console.log(`⏰ Horário Brasil: ${now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);

    // Busca mensagens pendentes na fila que já devem ser processadas
    const { data: pendingMessages, error: queueError } = await supabase
      .from('message_queue')
      .select('*')
      .eq('status', 'waiting')
      .lt('scheduled_for', new Date().toISOString())
      .lt('retry_count', 3) // Mudar para 'lt' ao invés de 'lte' para permitir retry_count = 0, 1, 2
      .order('created_at', { ascending: true })
      .limit(10); // Reduzir limite para 10 para evitar sobrecarga

    console.log(`🔍 Query executada com filtros:`, {
      status: 'waiting',
      scheduled_before: new Date().toISOString(),
      retry_count_less_than: 3
    });

    if (queueError) {
      throw new Error(`Error fetching pending messages: ${queueError.message}`);
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('✅ Nenhuma mensagem pendente para processar');
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        message: 'No pending messages to process' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📨 Encontradas ${pendingMessages.length} conversas com mensagens pendentes`);

    // Buscar configuração do Dify usando função segura
    const { data: integrationData, error: integrationError } = await supabase
      .rpc('get_integration_config_secure', { integration_type_param: 'dify' });

    if (integrationError || !integrationData || integrationData.length === 0) {
      console.error('❌ Erro ao acessar configuração Dify:', integrationError);
      
      await supabase.from('system_logs').insert({
        type: 'error',
        source: 'process-message-queue',
        message: 'Falha de acesso RLS à integração Dify',
        details: { 
          error: integrationError?.message,
          timestamp: new Date().toISOString() 
        }
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Integração Dify não acessível (RLS)',
        processed: 0,
        errors: 1,
        total_found: pendingMessages.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const integration = integrationData[0];
    if (!integration?.config) {
      console.error('❌ Configuração Dify vazia');
      
      await supabase.from('system_logs').insert({
        type: 'error',
        source: 'process-message-queue',
        message: 'Configuração Dify vazia',
        details: { timestamp: new Date().toISOString() }
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Configuração Dify vazia',
        processed: 0,
        errors: 1,
        total_found: pendingMessages.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integration.active) {
      console.error('❌ Integração Dify não ativa');
      
      await supabase.from('system_logs').insert({
        type: 'error',
        source: 'process-message-queue',
        message: 'Integração Dify não ativa',
        details: { timestamp: new Date().toISOString() }
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Integração Dify não ativa',
        processed: 0,
        errors: 1,
        total_found: pendingMessages.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = integration.config as { api_url: string };
    const apiKey = Deno.env.get('DIFY_API_KEY');
    
    if (!apiKey) {
      throw new Error('DIFY_API_KEY not found in secrets');
    }

    let processedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Processa cada entrada da fila
    for (const messageItem of pendingMessages) {
      try {
        console.log(`🔄 Processando conversa ${messageItem.conversation_id}...`);

        // Busca a conversa
        const { data: conversation } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', messageItem.conversation_id)
          .single();

        if (!conversation) {
          console.log(`❌ Conversa ${messageItem.conversation_id} não encontrada, removendo da fila`);
          
          await supabase
            .from('message_queue')
            .delete()
            .eq('id', messageItem.id);
          
          skippedCount++;
          continue;
        }

        // Verifica se a conversa ainda pode ser processada pelo bot
        if (conversation.fallback_mode) {
          console.log(`⚠️ Conversa ${messageItem.conversation_id} em modo fallback, pulando`);
          
          await supabase
            .from('message_queue')
            .update({ 
              status: 'skipped',
              processed_at: new Date().toISOString()
            })
            .eq('id', messageItem.id);

          skippedCount++;
          continue;
        }

        if (conversation.status === 'finished') {
          console.log(`✅ Conversa ${messageItem.conversation_id} já finalizada, pulando`);
          
          await supabase
            .from('message_queue')
            .update({ 
              status: 'skipped',
              processed_at: new Date().toISOString()
            })
            .eq('id', messageItem.id);

          skippedCount++;
          continue;
        }

        // Agrupa as mensagens da fila
        const groupedMessage = messageItem.messages_content?.join('\n') || '';
        
        if (!groupedMessage.trim()) {
          console.log(`📭 Mensagem vazia para conversa ${messageItem.conversation_id}, removendo da fila`);
          
          await supabase
            .from('message_queue')
            .delete()
            .eq('id', messageItem.id);
          
          skippedCount++;
          continue;
        }

        console.log(`💬 Enviando mensagem agrupada para Dify: "${groupedMessage.substring(0, 100)}..."`);

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
          console.log(`🔗 Usando Dify conversation_id existente: ${payload.conversation_id}`);
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
          console.error(`❌ Erro na API do Dify para conversa ${messageItem.conversation_id}: ${response.status} ${response.statusText} - ${errorText}`);
          
          // Marca como falha na fila
          await supabase
            .from('message_queue')
            .update({ 
              status: 'failed',
              processed_at: new Date().toISOString(),
              last_error: `Dify API error: ${response.status} ${response.statusText} - ${errorText}`
            })
            .eq('id', messageItem.id);

          // Log do erro
          await supabase.from('system_logs').insert({
            type: 'error',
            source: 'message_queue_processor',
            message: 'Erro ao processar mensagem da fila',
            details: {
              conversation_id: messageItem.conversation_id,
              phone_number: conversation.phone_number,
              error: `Dify API error: ${response.status} ${response.statusText} - ${errorText}`,
              queue_item_id: messageItem.id,
              grouped_message: groupedMessage
            }
          });

          errorCount++;
          continue;
        }

        const difyResponse: DifyResponse = await response.json();
        console.log(`✅ Resposta recebida do Dify: "${difyResponse.answer.substring(0, 100)}..."`);

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
            processed_from_queue: true,
            queue_item_id: messageItem.id,
            grouped_messages_count: messageItem.messages_content?.length || 0
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
          .eq('id', messageItem.conversation_id);

        // Envia resposta via WhatsApp (com tratamento de retry)
        console.log(`📱 Enviando resposta via WhatsApp para ${conversation.phone_number}`);
        
        try {
          await sendWhatsAppReply(conversation.phone_number, difyResponse.answer, supabase);
          
          // Sucesso - marca como enviado
          await supabase
            .from('message_queue')
            .update({ 
              status: 'sent',
              processed_at: new Date().toISOString()
            })
            .eq('id', messageItem.id);
            
        } catch (whatsappError) {
          console.error(`❌ Erro ao enviar WhatsApp para conversa ${messageItem.conversation_id}:`, whatsappError);
          
          // Incrementa contador de retry
          const newRetryCount = (messageItem.retry_count || 0) + 1;
          const maxRetries = messageItem.max_retries || 3;
          
          if (newRetryCount >= maxRetries) {
            // Esgotaram-se as tentativas - marca como falha
            await supabase
              .from('message_queue')
              .update({ 
                status: 'failed',
                processed_at: new Date().toISOString(),
                retry_count: newRetryCount,
                last_error: whatsappError.message
              })
              .eq('id', messageItem.id);
              
            console.log(`❌ Mensagem ${messageItem.id} marcada como falha após ${newRetryCount} tentativas`);
          } else {
            // Reagenda para nova tentativa em 30 segundos
            await supabase
              .from('message_queue')
              .update({ 
                retry_count: newRetryCount,
                scheduled_for: new Date(Date.now() + 30000).toISOString(), // 30 segundos
                last_error: whatsappError.message
              })
              .eq('id', messageItem.id);
              
            console.log(`🔄 Mensagem ${messageItem.id} reagendada para tentativa ${newRetryCount}/${maxRetries}`);
          }
          
          // Log de erro detalhado
          await supabase.from('system_logs').insert({
            type: 'error',
            source: 'message_queue_processor',
            message: 'Erro ao enviar mensagem via WhatsApp',
            details: {
              conversation_id: messageItem.conversation_id,
              phone_number: conversation.phone_number,
              retry_count: newRetryCount,
              max_retries: maxRetries,
              error: whatsappError.message,
              queue_item_id: messageItem.id,
              will_retry: newRetryCount < maxRetries
            }
          });
          
          errorCount++;
          continue; // Continua para próxima mensagem
        }

        // Log de sucesso
        await supabase.from('system_logs').insert({
          type: 'info',
          source: 'message_queue_processor',
          message: 'Mensagem da fila processada com sucesso',
          details: {
            conversation_id: messageItem.conversation_id,
            phone_number: conversation.phone_number,
            message_id: difyResponse.message_id,
            tokens_used: difyResponse.metadata.usage.total_tokens,
            queue_item_id: messageItem.id,
            grouped_messages_count: messageItem.messages_content?.length || 0
          }
        });

        processedCount++;
        console.log(`✅ Conversa ${messageItem.conversation_id} processada com sucesso`);

      } catch (error) {
        console.error(`❌ Erro ao processar conversa ${messageItem.conversation_id}:`, error);
        
        // Marca como falha na fila
        await supabase
          .from('message_queue')
          .update({ 
            status: 'failed',
            processed_at: new Date().toISOString(),
            last_error: error.message
          })
          .eq('id', messageItem.id);

        // Log do erro
        await supabase.from('system_logs').insert({
          type: 'error',
          source: 'message_queue_processor',
          message: 'Erro inesperado ao processar mensagem da fila',
          details: {
            conversation_id: messageItem.conversation_id,
            error: error.message,
            stack: error.stack,
            queue_item_id: messageItem.id
          }
        });

        errorCount++;
      }
    }

    const result = {
      success: true,
      processed: processedCount,
      errors: errorCount,
      skipped: skippedCount,
      total_found: pendingMessages.length,
      message: `Processadas ${processedCount} mensagens, ${errorCount} erros, ${skippedCount} puladas`
    };

    console.log(`🎯 Processamento concluído:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no processador da fila:', error);
    
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
    const { data, error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        to: phoneNumber,
        content: message, // Usar 'content' que é o campo correto
        type: 'text'
      }
    });

    if (error) {
      console.error('❌ Erro retornado pela função whatsapp-send:', error);
      throw new Error(`WhatsApp send error: ${error.message || JSON.stringify(error)}`);
    }

    if (!data?.success) {
      throw new Error(`WhatsApp send failed: ${data?.error || 'Unknown error'}`);
    }

    console.log(`📨 Resposta enviada via WhatsApp para ${phoneNumber}`);
  } catch (error) {
    console.error('❌ Erro ao invocar whatsapp-send:', error);
    throw error;
  }
}