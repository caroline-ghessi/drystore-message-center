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

    const results = [];

    // FASE 1: Resetar conversas em lotes (para evitar timeout)
    console.log('📊 FASE 1: Resetando conversas em lotes...');
    try {
      // Usar a função de processamento em lotes
      const { data: batchResults, error: batchError } = await supabase
        .rpc('reset_conversations_batch', { batch_size: 50 });

      if (batchError) {
        console.error('❌ Erro ao resetar conversas em lotes:', batchError);
        results.push(`❌ Erro ao resetar conversas: ${batchError.message}`);
      } else {
        let totalReset = 0;
        if (batchResults && batchResults.length > 0) {
          for (const batch of batchResults) {
            totalReset += batch.conversations_reset;
            console.log(`✅ Lote ${batch.batch_number}: ${batch.conversations_reset} conversas resetadas, ${batch.total_remaining} restantes`);
          }
        }
        console.log(`✅ Total de ${totalReset} conversas resetadas em ${batchResults?.length || 0} lotes`);
        results.push(`✅ ${totalReset} conversas resetadas em lotes`);
      }
    } catch (error) {
      console.error('❌ Erro na fase 1:', error);
      results.push(`❌ Fase 1 falhou: ${error.message}`);
    }

    // FASE 2: Forçar processamento das mensagens na fila em lotes
    console.log('📨 FASE 2: Processando mensagens pendentes em lotes...');
    try {
      // Primeiro, marcar mensagens antigas para reprocessamento imediato
      const { data: oldMessages, error: updateError } = await supabase
        .from('message_queue')
        .update({
          scheduled_for: new Date().toISOString(),
          status: 'waiting'
        })
        .lt('created_at', new Date(Date.now() - 60000).toISOString())
        .eq('status', 'waiting')
        .select('id');

      if (updateError) {
        console.error('❌ Erro ao reprocessar mensagens:', updateError);
        results.push(`❌ Erro ao reprocessar mensagens: ${updateError.message}`);
      } else {
        const count = oldMessages?.length || 0;
        console.log(`✅ ${count} mensagens marcadas para reprocessamento`);
        results.push(`✅ ${count} mensagens reprocessadas`);
        
        // Se há mensagens para processar, invocar o processador
        if (count > 0) {
          try {
            const { data: processResult, error: processError } = await supabase.functions.invoke('process-message-queue', {
              body: { auto_run: true, max_messages: 50 }
            });
            
            if (processError) {
              console.log('⚠️ Aviso no processamento de mensagens:', processError.message);
            } else {
              console.log('✅ Processamento de mensagens iniciado:', processResult);
            }
          } catch (processErr) {
            console.log('⚠️ Erro ao invocar processador:', processErr.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro na fase 2:', error);
      results.push(`❌ Fase 2 falhou: ${error.message}`);
    }

    // FASE 3: Recriar cron job
    console.log('⏰ FASE 3: Recriando cron job...');
    try {
      // Remover jobs existentes
      const { error: unscheduleError } = await supabase.rpc('remove_message_queue_crons');
      if (unscheduleError) {
        console.log('⚠️ Aviso ao remover crons existentes:', unscheduleError.message);
      }

      // Criar novo cron job
      const { error: cronError } = await supabase.rpc('create_message_queue_cron');
      if (cronError) {
        console.error('❌ Erro ao criar cron job:', cronError);
        results.push(`❌ Erro no cron job: ${cronError.message}`);
      } else {
        console.log('✅ Novo cron job criado com sucesso');
        results.push('✅ Cron job recriado');
      }
    } catch (error) {
      console.error('❌ Erro na fase 3:', error);
      results.push(`❌ Fase 3 falhou: ${error.message}`);
    }

    // FASE 4: Verificar estado final
    const { data: queueStatus } = await supabase
      .from('message_queue')
      .select('status')
      .eq('status', 'waiting');

    const { data: convStatus } = await supabase
      .from('conversations')
      .select('status')
      .eq('status', 'bot_attending');

    const summary = {
      pending_messages: queueStatus?.length || 0,
      bot_attending_conversations: convStatus?.length || 0,
      correction_results: results,
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