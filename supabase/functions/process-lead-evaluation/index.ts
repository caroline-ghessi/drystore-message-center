import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIAgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIAgentResponse {
  result: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  agentKey: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🤖 Iniciando processamento de avaliação de leads...');

    // Buscar conversas aguardando avaliação
    const { data: conversationsToEvaluate, error: searchError } = await supabase
      .from('conversations')
      .select(`
        id,
        phone_number,
        customer_name,
        created_at,
        updated_at,
        messages(
          id,
          content,
          message_type,
          sender_type,
          sender_name,
          created_at,
          metadata
        )
      `)
      .eq('status', 'waiting_evaluation')
      .limit(5); // Processar até 5 por vez para não sobrecarregar

    if (searchError) {
      console.error('❌ Erro ao buscar conversas para avaliação:', searchError);
      throw searchError;
    }

    console.log(`📊 Encontradas ${conversationsToEvaluate?.length || 0} conversas para avaliar`);

    if (!conversationsToEvaluate || conversationsToEvaluate.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma conversa aguardando avaliação',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evaluatedConversations = [];

    for (const conversation of conversationsToEvaluate) {
      try {
        console.log(`🔍 Avaliando conversa ${conversation.id}...`);

        // Preparar contexto da conversa para o agente avaliador
        const messages = conversation.messages || [];
        const conversationHistory = messages
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map((msg: any) => `${msg.sender_type === 'customer' ? 'Cliente' : 'Bot'}: ${msg.content}`)
          .join('\n');

        const context = {
          conversation_id: conversation.id,
          customer_name: conversation.customer_name || 'Não informado',
          phone_number: conversation.phone_number,
          total_messages: messages.length,
          conversation_history: conversationHistory,
          created_at: conversation.created_at,
          inactivity_time: '40+ minutos'
        };

        // Executar agente avaliador de leads
        const agentMessages: AIAgentMessage[] = [
          {
            role: 'user',
            content: `Analise esta conversa e avalie se vale a pena enviar este lead para um vendedor.

Contexto da Conversa:
- Cliente: ${context.customer_name}
- Telefone: ${context.phone_number}
- Total de mensagens: ${context.total_messages}
- Tempo de inatividade: ${context.inactivity_time}

Histórico da Conversa:
${context.conversation_history}

Critérios de Avaliação:
1. O cliente demonstrou interesse real em algum produto/serviço?
2. O cliente forneceu informações suficientes para um atendimento comercial?
3. A conversa não foi apenas uma consulta simples já resolvida pelo bot?
4. O cliente não abandonou a conversa no meio do atendimento sem demonstrar interesse?

Responda apenas com:
QUALIFICADO - se vale a pena enviar para vendedor
NÃO_QUALIFICADO - se não vale a pena enviar

Justifique sua decisão em uma linha.`
          }
        ];

        // Buscar configuração do agente avaliador
        const { data: agentConfig } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'ai_agents')
          .single();

        if (!agentConfig?.value?.lead_evaluator) {
          throw new Error('Agente Lead Evaluator não configurado');
        }

        const leadEvaluator = agentConfig.value.lead_evaluator;

        // Chamar função grok-agent
        const { data: evaluationResult, error: agentError } = await supabase.functions.invoke('grok-agent', {
          body: {
            agentKey: 'lead_evaluator',
            messages: agentMessages,
            context: context
          }
        });

        if (agentError) {
          console.error(`❌ Erro ao executar avaliador para conversa ${conversation.id}:`, agentError);
          continue;
        }

        const evaluation = evaluationResult?.result || '';
        const isQualified = evaluation.toUpperCase().includes('QUALIFICADO') && !evaluation.toUpperCase().includes('NÃO_QUALIFICADO');

        console.log(`📋 Conversa ${conversation.id} - Avaliação: ${isQualified ? 'QUALIFICADO' : 'NÃO_QUALIFICADO'}`);

        if (isQualified) {
          // Lead qualificado - enviar para orquestrador de transferência
          const { error: updateError } = await supabase
            .from('conversations')
            .update({ 
              status: 'qualified_for_transfer',
              updated_at: new Date().toISOString()
            })
            .eq('id', conversation.id);

          if (updateError) {
            console.error(`❌ Erro ao atualizar status da conversa ${conversation.id}:`, updateError);
          } else {
            console.log(`✅ Conversa ${conversation.id} qualificada para transferência`);
          }
        } else {
          // Lead não qualificado - finalizar conversa
          const { error: updateError } = await supabase
            .from('conversations')
            .update({ 
              status: 'finished',
              updated_at: new Date().toISOString()
            })
            .eq('id', conversation.id);

          if (updateError) {
            console.error(`❌ Erro ao finalizar conversa ${conversation.id}:`, updateError);
          } else {
            console.log(`🔚 Conversa ${conversation.id} finalizada - não qualificada`);
          }
        }

        // Log da avaliação
        await supabase.from('system_logs').insert({
          type: 'lead_evaluation',
          source: 'process-lead-evaluation',
          message: `Lead ${isQualified ? 'qualificado' : 'não qualificado'} para transferência`,
          details: {
            conversation_id: conversation.id,
            phone_number: conversation.phone_number,
            customer_name: conversation.customer_name,
            evaluation_result: evaluation,
            is_qualified: isQualified,
            new_status: isQualified ? 'qualified_for_transfer' : 'finished',
            agent_used: 'lead_evaluator'
          }
        });

        evaluatedConversations.push({
          conversation_id: conversation.id,
          is_qualified: isQualified,
          evaluation: evaluation
        });

      } catch (error) {
        console.error(`❌ Erro ao avaliar conversa ${conversation.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${evaluatedConversations.length} conversas avaliadas`,
        processed: evaluatedConversations.length,
        evaluations: evaluatedConversations
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no processamento de avaliação de leads:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Erro ao processar avaliação de leads'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});