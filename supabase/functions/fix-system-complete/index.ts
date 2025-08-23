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

    console.log('🔧 Iniciando correção completa do sistema...');

    // FASE 1: Resetar conversas com status inconsistente
    console.log('📊 FASE 1: Resetando conversas...');
    
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .update({
        status: 'bot_attending',
        fallback_mode: false,
        fallback_taken_by: null,
        updated_at: new Date().toISOString()
      })
      .eq('status', 'sent_to_seller')
      .eq('fallback_mode', true)
      .select('id, customer_name');

    if (convError) {
      console.error('❌ Erro ao resetar conversas:', convError);
      throw convError;
    }

    console.log(`✅ ${conversations?.length || 0} conversas resetadas para bot_attending`);

    // FASE 2: Processar mensagens pendentes imediatamente
    console.log('📨 FASE 2: Processando mensagens pendentes...');
    
    const { data: processResult, error: processError } = await supabase.functions.invoke('process-message-queue', {
      body: { force: true, immediate: true }
    });

    if (processError) {
      console.error('❌ Erro ao processar mensagens:', processError);
    } else {
      console.log('✅ Mensagens processadas:', processResult);
    }

    // FASE 3: Recriar cron job
    console.log('⏰ FASE 3: Recriando cron job...');
    
    // Remover jobs existentes
    const { error: unscheduleError } = await supabase.rpc('remove_message_queue_crons');
    if (unscheduleError) {
      console.log('⚠️ Aviso ao remover crons existentes:', unscheduleError.message);
    }

    // Criar novo cron job
    const { error: cronError } = await supabase.rpc('create_message_queue_cron');
    if (cronError) {
      console.error('❌ Erro ao criar cron job:', cronError);
    } else {
      console.log('✅ Novo cron job criado com sucesso');
    }

    // FASE 4: Testar conexão com Dify
    console.log('🤖 FASE 4: Testando conexão com Dify...');
    
    const { data: difyTest, error: difyError } = await supabase.functions.invoke('test-dify-connection', {
      body: { test_message: 'Teste de conexão após correção completa' }
    });

    if (difyError) {
      console.error('❌ Erro na conexão com Dify:', difyError);
    } else {
      console.log('✅ Conexão com Dify testada:', difyTest);
    }

    // FASE 5: Verificar estado final
    const { data: queueStatus } = await supabase
      .from('message_queue')
      .select('status')
      .eq('status', 'waiting');

    const { data: convStatus } = await supabase
      .from('conversations')
      .select('status')
      .eq('status', 'bot_attending');

    const summary = {
      conversations_reset: conversations?.length || 0,
      bot_attending_conversations: convStatus?.length || 0,
      pending_messages: queueStatus?.length || 0,
      dify_connection: difyError ? 'failed' : 'success',
      cron_job: cronError ? 'failed' : 'success',
      message_processing: processError ? 'failed' : 'success',
      timestamp: new Date().toISOString()
    };

    console.log('📋 Resumo da correção:', summary);

    // Log no sistema
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'system_fix',
      message: 'Correção completa do sistema executada',
      details: summary
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Correção completa executada com sucesso',
      summary,
      next_steps: [
        'Aguardar 30 segundos para primeira execução automática do cron job',
        'Enviar mensagem de teste do seu WhatsApp',
        'Verificar se o bot responde automaticamente em até 90 segundos'
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro na correção completa:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});