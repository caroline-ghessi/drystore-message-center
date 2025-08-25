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

    console.log('🔧 Teste simples - Inserindo resposta para Caroline...');

    // Buscar conversa da Caroline
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('customer_name', 'Caroline Ghessi')
      .single();

    if (convError || !conversation) {
      console.error('❌ Conversa da Caroline não encontrada:', convError);
      throw new Error('Conversa não encontrada');
    }

    console.log('💬 Conversa da Caroline encontrada:', conversation.id);

    // Inserir uma resposta simples do bot
    const { data: botMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'bot',
        sender_name: 'Drystore Bot',
        content: 'Olá Caroline! Vi que você está interessada em telhado shingle. Temos várias opções disponíveis em nossa linha. Você gostaria de saber sobre as cores disponíveis ou precisa de um orçamento específico?',
        message_type: 'text',
        delivery_status: 'sent',
        message_source: 'dify'
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ Erro ao salvar mensagem do bot:', messageError);
      throw messageError;
    }

    console.log('💾 Mensagem do bot salva com sucesso');

    // Marcar mensagem da fila como processada
    const { error: queueError } = await supabase
      .from('message_queue')
      .update({
        status: 'sent',
        processed_at: new Date().toISOString()
      })
      .eq('id', '500b1299-e566-4675-951a-defa1da06e4b');

    if (queueError) {
      console.error('⚠️ Erro ao atualizar fila:', queueError);
    } else {
      console.log('✅ Fila atualizada');
    }

    // Log de sucesso
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'dify',
        message: 'Resposta manual inserida para Caroline',
        details: {
          conversation_id: conversation.id,
          customer_name: conversation.customer_name,
          bot_response: 'Resposta sobre telhado shingle'
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: 'Resposta inserida para Caroline com sucesso',
      details: {
        customer: conversation.customer_name,
        message_id: botMessage.id
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});