
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIAgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🚀 Iniciando orquestração de transferência inteligente...');

    // Buscar conversas qualificadas para transferência
    const { data: qualifiedConversations, error: searchError } = await supabase
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
      .eq('status', 'qualified_for_transfer')
      .limit(3); // Processar até 3 por vez

    if (searchError) {
      console.error('❌ Erro ao buscar conversas qualificadas:', searchError);
      throw searchError;
    }

    console.log(`📊 Encontradas ${qualifiedConversations?.length || 0} conversas para transferir`);

    if (!qualifiedConversations || qualifiedConversations.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma conversa qualificada para transferência',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar vendedores ativos
    const { data: activeSellers, error: sellersError } = await supabase
      .from('sellers')
      .select(`
        id,
        name,
        phone_number,
        current_workload,
        max_concurrent_leads,
        experience_years,
        performance_score,
        conversion_rate,
        average_ticket,
        personality_type,
        seller_specialties(
          product_category_id,
          expertise_level,
          product_categories(name)
        ),
        seller_skills(
          skill_name,
          skill_type,
          proficiency_level
        )
      `)
      .eq('active', true)
      .eq('deleted', false);

    if (sellersError || !activeSellers || activeSellers.length === 0) {
      console.error('❌ Nenhum vendedor ativo encontrado:', sellersError);
      throw new Error('Nenhum vendedor ativo disponível');
    }

    // Buscar configuração do Rodrigo Bot
    const { data: rodrigoBot, error: rodrigoError } = await supabase
      .from('whapi_configurations')
      .select('*')
      .eq('type', 'rodrigo_bot')
      .eq('active', true)
      .single();

    if (rodrigoError || !rodrigoBot) {
      console.error('❌ Rodrigo Bot não configurado:', rodrigoError);
      throw new Error('Rodrigo Bot não está configurado corretamente');
    }

    // Buscar token do Rodrigo Bot dos secrets
    const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-secret', {
      body: { secretName: rodrigoBot.token_secret_name }
    });

    if (tokenError || !tokenData?.value) {
      console.error('❌ Token do Rodrigo Bot não encontrado:', tokenError);
      throw new Error(`Token do Rodrigo Bot não encontrado. Secret: ${rodrigoBot.token_secret_name}`);
    }

    const rodrigoToken = tokenData.value;
    console.log(`✅ Token do Rodrigo Bot obtido: ${rodrigoToken.substring(0, 10)}...`);

    const transferredConversations = [];

    for (const conversation of qualifiedConversations) {
      try {
        console.log(`🔄 Processando transferência da conversa ${conversation.id}...`);

        // Preparar contexto da conversa
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
          created_at: conversation.created_at
        };

        // 1. Gerar resumo da conversa
        console.log(`📝 Gerando resumo para conversa ${conversation.id}...`);
        const summaryMessages: AIAgentMessage[] = [
          {
            role: 'user',
            content: `Gere um resumo profissional desta conversa para envio ao vendedor.

Contexto da Conversa:
- Cliente: ${context.customer_name}
- Telefone: ${context.phone_number}
- Total de mensagens: ${context.total_messages}

Histórico da Conversa:
${context.conversation_history}

Gere um resumo seguindo EXATAMENTE este formato:

⚡NOVO LEAD:
- Cliente: [Nome do cliente]
- WhatsApp: [Telefone]
- Produto: [Produto/serviço de interesse identificado]

⚡ SITUAÇÃO:
- Principal problema ou necessidade do cliente: [Descreva]
- Motivação da compra: [Analise a motivação]
- Localização: [Se mencionado, senão "Não informado"]
- Urgência demonstrada: [Baixa/Média/Alta ou "Não informado"]
- Orçamento/prazo mencionado: [Se mencionado, senão "Não informado"]

📋 PRÓXIMOS PASSOS:
1. [Primeira ação recomendada]
2. [Segunda ação recomendada]
3. [Terceira ação recomendada]`
          }
        ];

        const { data: summaryResult, error: summaryError } = await supabase.functions.invoke('anthropic-agent', {
          body: {
            agentKey: 'summary_generator',
            messages: summaryMessages,
            context: context
          }
        });

        if (summaryError) {
          console.error(`❌ Erro ao gerar resumo para conversa ${conversation.id}:`, summaryError);
          continue;
        }

        const summary = summaryResult?.result || '';
        console.log(`✅ Resumo gerado para conversa ${conversation.id}`);

        // 2. Fazer matching do vendedor
        console.log(`🎯 Fazendo matching de vendedor para conversa ${conversation.id}...`);
        const matchingMessages: AIAgentMessage[] = [
          {
            role: 'user',
            content: `Analise esta conversa e sugira o melhor vendedor baseado no perfil do cliente e produto de interesse.

Resumo da Conversa:
${summary}

Vendedores Disponíveis:
${activeSellers.map(seller => `
- ${seller.name} (ID: ${seller.id})
  - Telefone: ${seller.phone_number}
  - Carga atual: ${seller.current_workload}/${seller.max_concurrent_leads}
  - Experiência: ${seller.experience_years} anos
  - Performance: ${seller.performance_score}
  - Taxa conversão: ${seller.conversion_rate}%
  - Ticket médio: R$ ${seller.average_ticket}
  - Personalidade: ${seller.personality_type}
  - Especialidades: ${seller.seller_specialties?.map((s: any) => s.product_categories?.name).join(', ') || 'Nenhuma'}
  - Habilidades: ${seller.seller_skills?.map((h: any) => `${h.skill_name} (${h.proficiency_level}/5)`).join(', ') || 'Nenhuma'}
`).join('\n')}

Responda apenas com o ID do vendedor mais adequado e uma justificativa de uma linha.
Formato: SELLER_ID: [uuid]
JUSTIFICATIVA: [motivo da escolha]`
          }
        ];

        const { data: matchingResult, error: matchingError } = await supabase.functions.invoke('grok-agent', {
          body: {
            agentKey: 'seller_matcher',
            messages: matchingMessages,
            context: { ...context, summary, sellers: activeSellers }
          }
        });

        if (matchingError) {
          console.error(`❌ Erro ao fazer matching de vendedor para conversa ${conversation.id}:`, matchingError);
          continue;
        }

        const matchingResponse = matchingResult?.result || '';
        const sellerIdMatch = matchingResponse.match(/SELLER_ID:\s*([a-f0-9-]+)/i);
        const selectedSellerId = sellerIdMatch ? sellerIdMatch[1] : null;

        if (!selectedSellerId) {
          console.error(`❌ Não foi possível extrair ID do vendedor da resposta: ${matchingResponse}`);
          continue;
        }

        const selectedSeller = activeSellers.find(s => s.id === selectedSellerId);
        if (!selectedSeller) {
          console.error(`❌ Vendedor selecionado não encontrado: ${selectedSellerId}`);
          continue;
        }

        console.log(`✅ Vendedor selecionado: ${selectedSeller.name} (${selectedSeller.id})`);

        // 3. Enviar resumo via Rodrigo Bot - CORRIGIDO: do bot PARA o vendedor
        console.log(`📱 Enviando resumo via Rodrigo Bot do ${rodrigoBot.phone_number} para ${selectedSeller.name} (${selectedSeller.phone_number})...`);
        
        const messageContent = `🎯 *NOVO LEAD RECEBIDO*

*Cliente:* ${conversation.customer_name || 'Cliente'}
*Telefone:* ${conversation.phone_number}
*ID da Conversa:* ${conversation.id}

*📋 Resumo do Atendimento:*
${summary}

---
_Lead distribuído automaticamente pelo sistema_
_Responda o cliente o quanto antes_`;

        const { data: sendResult, error: sendError } = await supabase.functions.invoke('whapi-send', {
          body: {
            token: rodrigoToken,
            to: selectedSeller.phone_number,
            content: messageContent,
            type: 'text'
          }
        });

        if (sendError) {
          console.error(`❌ Erro ao enviar mensagem via Rodrigo Bot:`, sendError);
          continue;
        }

        if (!sendResult?.success) {
          console.error(`❌ Falha no envio via Rodrigo Bot:`, sendResult);
          continue;
        }

        console.log(`✅ Resumo enviado via WhatsApp de ${rodrigoBot.phone_number} para ${selectedSeller.name} (${selectedSeller.phone_number})`);

        // 4. Criar lead no banco
        const { data: leadData, error: leadError } = await supabase
          .from('leads')
          .insert({
            conversation_id: conversation.id,
            customer_name: conversation.customer_name || 'Cliente',
            phone_number: conversation.phone_number,
            seller_id: selectedSeller.id,
            summary: summary,
            ai_evaluation: matchingResponse,
            status: 'sent_to_seller',
            sent_at: new Date().toISOString()
          })
          .select()
          .single();

        if (leadError) {
          console.error(`❌ Erro ao criar lead:`, leadError);
          continue;
        }

        // 5. Atualizar conversa
        const { error: updateError } = await supabase
          .from('conversations')
          .update({ 
            status: 'sent_to_seller',
            assigned_seller_id: selectedSeller.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar conversa:`, updateError);
          continue;
        }

        // 6. Atualizar carga de trabalho do vendedor
        await supabase
          .from('sellers')
          .update({ 
            current_workload: selectedSeller.current_workload + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedSeller.id);

        // 7. Log da transferência
        await supabase.from('system_logs').insert({
          type: 'intelligent_transfer',
          source: 'intelligent-transfer-orchestrator',
          message: `Lead transferido automaticamente para vendedor`,
          details: {
            conversation_id: conversation.id,
            lead_id: leadData.id,
            seller_id: selectedSeller.id,
            seller_name: selectedSeller.name,
            seller_phone: selectedSeller.phone_number,
            customer_name: conversation.customer_name,
            customer_phone: conversation.phone_number,
            summary_length: summary.length,
            matching_justification: matchingResponse,
            rodrigo_bot_phone: rodrigoBot.phone_number,
            rodrigo_token_used: rodrigoToken.substring(0, 10) + '...',
            whapi_message_id: sendResult.message_id,
            corrected_flow: true
          }
        });

        transferredConversations.push({
          conversation_id: conversation.id,
          lead_id: leadData.id,
          seller_id: selectedSeller.id,
          seller_name: selectedSeller.name,
          seller_phone: selectedSeller.phone_number,
          message_id: sendResult.message_id
        });

        console.log(`🎉 Transferência completa - Conversa ${conversation.id} → ${selectedSeller.name} (${selectedSeller.phone_number})`);

      } catch (error) {
        console.error(`❌ Erro ao processar transferência da conversa ${conversation.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${transferredConversations.length} conversas transferidas automaticamente`,
        processed: transferredConversations.length,
        transfers: transferredConversations,
        corrected_flow: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na orquestração de transferência inteligente:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Erro na orquestração de transferência inteligente'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
