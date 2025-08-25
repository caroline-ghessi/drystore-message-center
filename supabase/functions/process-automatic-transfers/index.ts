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

    console.log('🤖 Iniciando processamento de transferências automáticas...');

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
      .limit(5); // Processar até 5 por vez

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

    const processedTransfers = [];

    for (const conversation of qualifiedConversations) {
      try {
        console.log(`🔄 Processando transferência da conversa ${conversation.id}...`);

        // Preparar contexto da conversa para matching de vendedor
        const messages = conversation.messages || [];
        const conversationHistory = messages
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map((msg: any) => `${msg.sender_type === 'customer' ? 'Cliente' : 'Bot'}: ${msg.content}`)
          .join('\n');

        // Buscar vendedores ativos disponíveis
        const { data: availableSellers, error: sellersError } = await supabase
          .from('sellers')
          .select('*')
          .eq('active', true)
          .eq('deleted', false)
          .lt('current_workload', supabase.raw('max_concurrent_leads'));

        if (sellersError || !availableSellers || availableSellers.length === 0) {
          console.log(`⚠️ Nenhum vendedor disponível para conversa ${conversation.id}`);
          continue;
        }

        // Usar IA para fazer matching do melhor vendedor
        const agentMessages: AIAgentMessage[] = [
          {
            role: 'user',
            content: `Analise esta conversa de cliente e selecione o melhor vendedor baseado no perfil e histórico da conversa.

Informações do Cliente:
- Nome: ${conversation.customer_name || 'Não informado'}
- Telefone: ${conversation.phone_number}

Histórico da Conversa:
${conversationHistory}

Vendedores Disponíveis:
${availableSellers.map(seller => 
  `- ${seller.name} (ID: ${seller.id})
    Personalidade: ${seller.personality_type}
    Experiência: ${seller.experience_years} anos
    Score Performance: ${seller.performance_score}/100
    Taxa Conversão: ${seller.conversion_rate}%
    Carga Atual: ${seller.current_workload}/${seller.max_concurrent_leads}`
).join('\n')}

Baseado no histórico da conversa e perfil dos vendedores, selecione o melhor vendedor.
Responda apenas com o ID do vendedor selecionado.`
          }
        ];

        // Chamar agente para matching
        const { data: matchingResult, error: agentError } = await supabase.functions.invoke('grok-agent', {
          body: {
            agentKey: 'seller_matcher',
            messages: agentMessages,
            context: { conversation_id: conversation.id }
          }
        });

        if (agentError) {
          console.error(`❌ Erro no matching para conversa ${conversation.id}:`, agentError);
          // Fallback: selecionar vendedor com menor carga de trabalho
          const selectedSeller = availableSellers.reduce((prev, current) => 
            prev.current_workload < current.current_workload ? prev : current
          );
          
          await transferToSeller(supabase, conversation, selectedSeller, 'Seleção automática por menor carga de trabalho');
        } else {
          const selectedSellerId = matchingResult?.result?.trim();
          const selectedSeller = availableSellers.find(s => s.id === selectedSellerId);

          if (selectedSeller) {
            await transferToSeller(supabase, conversation, selectedSeller, 'Seleção automática por IA');
          } else {
            // Fallback se IA não retornou ID válido
            const fallbackSeller = availableSellers[0];
            await transferToSeller(supabase, conversation, fallbackSeller, 'Seleção automática - fallback');
          }
        }

        processedTransfers.push({
          conversation_id: conversation.id,
          status: 'processed'
        });

      } catch (error) {
        console.error(`❌ Erro ao processar transferência da conversa ${conversation.id}:`, error);
        processedTransfers.push({
          conversation_id: conversation.id,
          status: 'error',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${processedTransfers.length} transferências processadas`,
        processed: processedTransfers.length,
        transfers: processedTransfers
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no processamento de transferências automáticas:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Erro ao processar transferências automáticas'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function transferToSeller(supabase: any, conversation: any, seller: any, method: string) {
  console.log(`👤 Transferindo conversa ${conversation.id} para vendedor ${seller.name}`);

  // Gerar resumo da conversa
  const messages = conversation.messages || [];
  const customerMessages = messages.filter((msg: any) => msg.sender_type === 'customer');
  const lastCustomerMessage = customerMessages[customerMessages.length - 1];
  
  const summary = `Cliente: ${conversation.customer_name || 'Não informado'}
Última mensagem: ${lastCustomerMessage?.content || 'Nenhuma mensagem'}
Total de mensagens: ${messages.length}
Método de seleção: ${method}`;

  // 1. Criar lead
  const { data: leadData, error: leadError } = await supabase
    .from('leads')
    .insert({
      conversation_id: conversation.id,
      seller_id: seller.id,
      customer_name: conversation.customer_name || 'Cliente',
      phone_number: conversation.phone_number,
      summary: summary,
      status: 'attending'
    })
    .select()
    .single();

  if (leadError) {
    console.error(`❌ Erro ao criar lead:`, leadError);
    throw leadError;
  }

  // 2. Atualizar status da conversa
  const { error: conversationError } = await supabase
    .from('conversations')
    .update({ 
      status: 'sent_to_seller',
      assigned_seller_id: seller.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', conversation.id);

  if (conversationError) {
    console.error(`❌ Erro ao atualizar conversa:`, conversationError);
    throw conversationError;
  }

  // 3. Atualizar carga de trabalho do vendedor
  const { error: sellerError } = await supabase
    .from('sellers')
    .update({ 
      current_workload: seller.current_workload + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', seller.id);

  if (sellerError) {
    console.error(`❌ Erro ao atualizar vendedor:`, sellerError);
  }

  // 4. Enviar notificação via WhatsApp usando Rodrigo Bot
  try {
    const notificationMessage = `🔔 *Novo Lead Recebido!*

👤 Cliente: ${conversation.customer_name || 'Não informado'}
📱 Telefone: ${conversation.phone_number}
📝 Resumo: ${summary}

Acesse o painel para iniciar o atendimento.`;

    const { error: notificationError } = await supabase.functions.invoke('whapi-send', {
      body: {
        phone_to: seller.phone_number,
        content: notificationMessage,
        message_type: 'text',
        token_secret_name: 'WHAPI_TOKEN_5551981155622' // Rodrigo Bot
      }
    });

    if (notificationError) {
      console.error(`⚠️ Erro ao notificar vendedor:`, notificationError);
    } else {
      console.log(`✅ Vendedor ${seller.name} notificado com sucesso`);
    }
  } catch (notificationError) {
    console.error(`⚠️ Erro na notificação:`, notificationError);
  }

  // 5. Log da transferência
  await supabase.from('system_logs').insert({
    type: 'automatic_transfer',
    source: 'process-automatic-transfers',
    message: `Lead transferido automaticamente para vendedor`,
    details: {
      conversation_id: conversation.id,
      lead_id: leadData.id,
      seller_id: seller.id,
      seller_name: seller.name,
      customer_name: conversation.customer_name,
      phone_number: conversation.phone_number,
      selection_method: method,
      timestamp: new Date().toISOString()
    }
  });

  console.log(`✅ Transferência automática concluída - Lead ${leadData.id} para ${seller.name}`);
}