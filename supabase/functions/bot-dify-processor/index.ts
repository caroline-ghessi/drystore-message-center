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

    console.log('🤖 Bot Dify Processor iniciado');

    // Busca mensagens pendentes na fila
    const { data: queueMessages, error: queueError } = await supabase
      .from('message_queue')
      .select(`
        id,
        conversation_id,
        messages_content,
        customer_phone,
        created_at
      `)
      .eq('status', 'waiting')
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(10); // Processa até 10 mensagens por vez

    if (queueError) {
      throw new Error(`Error fetching queue messages: ${queueError.message}`);
    }

    if (!queueMessages || queueMessages.length === 0) {
      console.log('📭 Nenhuma mensagem pendente na fila');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No pending messages to process',
        processed_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Encontradas ${queueMessages.length} mensagens pendentes para processar`);

    let processed_count = 0;
    let error_count = 0;

    // Processa cada mensagem
    for (const queueMessage of queueMessages) {
      try {
        console.log(`🔄 Processando mensagem ${queueMessage.id} da conversa ${queueMessage.conversation_id}`);

        // Verifica se a conversa ainda está em modo bot
        const { data: conversation } = await supabase
          .from('conversations')
          .select('status, fallback_mode')
          .eq('id', queueMessage.conversation_id)
          .single();

        if (!conversation || conversation.fallback_mode || conversation.status !== 'bot_attending') {
          console.log(`⏭️ Conversa ${queueMessage.conversation_id} não está mais em modo bot, pulando`);
          
          // Marca como pulada
          await supabase
            .from('message_queue')
            .update({ 
              status: 'skipped',
              processed_at: new Date().toISOString()
            })
            .eq('id', queueMessage.id);
          
          processed_count++;
          continue;
        }

        // Chama o processador principal do Dify
        const { data, error } = await supabase.functions.invoke('dify-process-messages', {
          body: {
            conversationId: queueMessage.conversation_id,
            phoneNumber: queueMessage.customer_phone,
            messageContent: queueMessage.messages_content.join(' '),
            queueId: queueMessage.id
          }
        });

        if (error) {
          throw new Error(`Dify processing error: ${error.message}`);
        }

        console.log(`✅ Mensagem ${queueMessage.id} processada com sucesso`);
        processed_count++;

      } catch (error) {
        console.error(`❌ Erro ao processar mensagem ${queueMessage.id}:`, error);
        error_count++;

        // Marca mensagem como erro
        await supabase
          .from('message_queue')
          .update({ 
            status: 'error',
            processed_at: new Date().toISOString()
          })
          .eq('id', queueMessage.id);

        // Log do erro
        await supabase.from('system_logs').insert({
          type: 'error',
          source: 'dify',
          message: 'Erro no processador de fila do bot',
          details: {
            queue_message_id: queueMessage.id,
            conversation_id: queueMessage.conversation_id,
            error: error.message,
            customer_phone: queueMessage.customer_phone
          }
        });
      }
    }

    // Log do resultado geral
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'dify',
      message: 'Processamento da fila concluído',
      details: {
        total_messages: queueMessages.length,
        processed_count,
        error_count,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`🏁 Processamento concluído: ${processed_count} processadas, ${error_count} erros`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Queue processing completed',
      total_messages: queueMessages.length,
      processed_count,
      error_count
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro crítico no bot-dify-processor:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: `Critical error: ${error.message}`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});