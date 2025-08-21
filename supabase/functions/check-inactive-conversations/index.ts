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

    console.log('🔍 Verificando conversas inativas...');

    // Busca conversas em bot_attending que não tiveram atividade nos últimos 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: inactiveConversations, error } = await supabase
      .from('conversations')
      .select(`
        id, 
        phone_number, 
        customer_name, 
        status, 
        updated_at,
        metadata
      `)
      .eq('status', 'bot_attending')
      .eq('fallback_mode', false)
      .lt('updated_at', fiveMinutesAgo);

    if (error) {
      throw new Error(`Error fetching inactive conversations: ${error.message}`);
    }

    if (!inactiveConversations || inactiveConversations.length === 0) {
      console.log('✅ Nenhuma conversa inativa encontrada');
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        message: 'No inactive conversations found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Encontradas ${inactiveConversations.length} conversas inativas`);

    let processedCount = 0;
    let errorCount = 0;

    // Processa cada conversa inativa
    for (const conversation of inactiveConversations) {
      try {
        console.log(`⏰ Processando conversa inativa: ${conversation.id}`);

        // Verifica se há mensagens pendentes na fila para esta conversa
        const { data: pendingMessages } = await supabase
          .from('message_queue')
          .select('id')
          .eq('conversation_id', conversation.id)
          .eq('status', 'waiting');

        if (pendingMessages && pendingMessages.length > 0) {
          console.log(`⚠️ Conversa ${conversation.id} tem mensagens pendentes na fila, aguardando processamento`);
          continue;
        }

        // Verifica se houve mensagens recentes do cliente
        const { data: recentMessages } = await supabase
          .from('messages')
          .select('id, created_at, sender_type')
          .eq('conversation_id', conversation.id)
          .gte('created_at', fiveMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1);

        if (recentMessages && recentMessages.length > 0) {
          console.log(`📨 Conversa ${conversation.id} teve mensagens recentes, mantendo em bot_attending`);
          continue;
        }

        // Avalia se vale a pena transferir para vendedor
        const evaluationResult = await evaluateConversationForTransfer(supabase, conversation);

        if (evaluationResult.shouldTransfer) {
          // Prepara lead para transferir ao vendedor
          await processLeadTransfer(supabase, conversation, evaluationResult);
          processedCount++;
        } else {
          // Marca conversa como finalizada se não vale a pena continuar
          await supabase
            .from('conversations')
            .update({ 
              status: 'finished',
              metadata: {
                ...conversation.metadata,
                finished_reason: 'inactive_not_qualified',
                finished_at: new Date().toISOString()
              }
            })
            .eq('id', conversation.id);

          console.log(`🔚 Conversa ${conversation.id} finalizada por inatividade (não qualificada)`);
          processedCount++;
        }

      } catch (error) {
        console.error(`❌ Erro ao processar conversa ${conversation.id}:`, error);
        errorCount++;

        // Log do erro
        await supabase.from('system_logs').insert({
          type: 'error',
          source: 'check_inactive_conversations',
          message: 'Erro ao processar conversa inativa',
          details: {
            conversation_id: conversation.id,
            error: error.message,
            stack: error.stack
          }
        });
      }
    }

    const result = {
      success: true,
      processed: processedCount,
      errors: errorCount,
      total_found: inactiveConversations.length,
      message: `Processadas ${processedCount} conversas inativas, ${errorCount} erros`
    };

    console.log(`🎯 Verificação de conversas inativas concluída:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro na verificação de conversas inativas:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function evaluateConversationForTransfer(supabase: any, conversation: any) {
  try {
    // Busca mensagens da conversa para análise
    const { data: messages } = await supabase
      .from('messages')
      .select('content, sender_type, message_type')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      return { shouldTransfer: false, reason: 'no_messages' };
    }

    // Mensagens do cliente
    const customerMessages = messages
      .filter(m => m.sender_type === 'customer')
      .map(m => m.content)
      .join(' ');

    // Avaliação simples baseada em palavras-chave
    const qualificationKeywords = [
      'orçamento', 'preço', 'valor', 'quanto custa', 'comprar',
      'interessado', 'quero', 'preciso', 'telha', 'construção',
      'obra', 'material', 'metro', 'quantidade'
    ];

    const hasQualificationIndicators = qualificationKeywords.some(keyword => 
      customerMessages.toLowerCase().includes(keyword)
    );

    const messageCount = messages.length;
    const hasMultipleExchanges = messageCount >= 4; // Pelo menos 4 mensagens na conversa

    if (hasQualificationIndicators && hasMultipleExchanges) {
      return {
        shouldTransfer: true,
        reason: 'qualified_lead',
        summary: `Cliente demonstrou interesse em produtos com ${messageCount} mensagens trocadas`
      };
    }

    if (hasQualificationIndicators) {
      return {
        shouldTransfer: true,
        reason: 'potential_interest',
        summary: `Cliente demonstrou interesse, mas conversa ainda curta (${messageCount} mensagens)`
      };
    }

    return {
      shouldTransfer: false,
      reason: 'not_qualified',
      summary: `Conversa sem indicadores de qualificação (${messageCount} mensagens)`
    };

  } catch (error) {
    console.error('Erro na avaliação da conversa:', error);
    return {
      shouldTransfer: false,
      reason: 'evaluation_error',
      error: error.message
    };
  }
}

async function processLeadTransfer(supabase: any, conversation: any, evaluation: any) {
  try {
    console.log(`🎯 Transferindo lead qualificado: ${conversation.id}`);

    // Chama o orquestrador inteligente para fazer o match com vendedor
    const { data, error } = await supabase.functions.invoke('intelligent-transfer-orchestrator', {
      body: {
        conversationId: conversation.id,
        customerName: conversation.customer_name,
        phoneNumber: conversation.phone_number,
        summary: evaluation.summary,
        reason: 'inactive_timeout'
      }
    });

    if (error) {
      throw error;
    }

    // Log de sucesso
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'check_inactive_conversations',
      message: 'Lead transferido por timeout de inatividade',
      details: {
        conversation_id: conversation.id,
        phone_number: conversation.phone_number,
        evaluation_reason: evaluation.reason,
        summary: evaluation.summary,
        transfer_result: data
      }
    });

    console.log(`✅ Lead ${conversation.id} transferido com sucesso`);

  } catch (error) {
    console.error(`❌ Erro ao transferir lead ${conversation.id}:`, error);
    throw error;
  }
}