import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 Iniciando verificação de conversas inativas...');

    // Buscar conversas em bot_attending sem atividade por 20+ minutos
    const twentyMinutesAgo = new Date();
    twentyMinutesAgo.setMinutes(twentyMinutesAgo.getMinutes() - 20);

    const { data: inactiveConversations, error: searchError } = await supabase
      .from('conversations')
      .select(`
        id,
        phone_number,
        customer_name,
        created_at,
        updated_at,
        messages(created_at, sender_type)
      `)
      .eq('status', 'bot_attending')
      .eq('fallback_mode', false)
      .lt('updated_at', twentyMinutesAgo.toISOString());

    if (searchError) {
      console.error('❌ Erro ao buscar conversas inativas:', searchError);
      throw searchError;
    }

    console.log(`📊 Encontradas ${inactiveConversations?.length || 0} conversas candidatas a avaliação`);

    if (!inactiveConversations || inactiveConversations.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma conversa inativa encontrada',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filtrar conversas que realmente têm mensagens do cliente
    const conversationsToEvaluate = inactiveConversations.filter(conv => {
      const messages = conv.messages || [];
      const hasCustomerMessages = messages.some((msg: any) => msg.sender_type === 'customer');
      
      if (!hasCustomerMessages) {
        console.log(`⏭️ Conversa ${conv.id} ignorada - sem mensagens do cliente`);
        return false;
      }

      // Verificar se a última mensagem do cliente foi há mais de 20 minutos
      const customerMessages = messages.filter((msg: any) => msg.sender_type === 'customer');
      const lastCustomerMessage = customerMessages
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (lastCustomerMessage) {
        const lastMessageTime = new Date(lastCustomerMessage.created_at);
        const timeDiff = Date.now() - lastMessageTime.getTime();
        const minutesDiff = timeDiff / (1000 * 60);
        
        if (minutesDiff < 20) {
          console.log(`⏭️ Conversa ${conv.id} ignorada - última mensagem há ${minutesDiff.toFixed(1)} minutos`);
          return false;
        }
      }

      return true;
    });

    console.log(`✅ ${conversationsToEvaluate.length} conversas selecionadas para avaliação`);

    // Atualizar status das conversas selecionadas para waiting_evaluation
    const updatedConversations = [];
    
    for (const conversation of conversationsToEvaluate) {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          status: 'waiting_evaluation',
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

      if (updateError) {
        console.error(`❌ Erro ao atualizar conversa ${conversation.id}:`, updateError);
      } else {
        console.log(`📝 Conversa ${conversation.id} marcada para avaliação`);
        updatedConversations.push(conversation.id);

        // Log da ação
        await supabase.from('system_logs').insert({
          type: 'conversation_status_change',
          source: 'check-inactive-conversations',
          message: `Conversa ${conversation.id} marcada para avaliação por inatividade`,
          details: {
            conversation_id: conversation.id,
            phone_number: conversation.phone_number,
            customer_name: conversation.customer_name,
            previous_status: 'bot_attending',
            new_status: 'waiting_evaluation',
            inactivity_duration_minutes: 20
          }
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${updatedConversations.length} conversas marcadas para avaliação`,
        processed: updatedConversations.length,
        conversation_ids: updatedConversations
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na verificação de conversas inativas:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Erro ao verificar conversas inativas'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});