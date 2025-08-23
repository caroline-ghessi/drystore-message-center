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

    console.log('🧪 Testando processamento da fila...');

    // 1. Verificar estado atual da fila
    const { data: queueData, error: queueError } = await supabase
      .from('message_queue')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(5);

    if (queueError) {
      console.error('❌ Erro ao buscar fila:', queueError);
      throw queueError;
    }

    console.log(`📊 Mensagens em espera: ${queueData?.length || 0}`);

    // 2. Executar process-message-queue
    console.log('🔄 Executando process-message-queue...');
    const { data: processResult, error: processError } = await supabase.functions.invoke('process-message-queue', {
      body: {}
    });

    console.log('📝 Resultado process-message-queue:', processResult);
    if (processError) {
      console.error('❌ Erro process-message-queue:', processError);
    }

    // 3. Executar force-process-caroline
    console.log('🎯 Executando force-process-caroline...');
    const { data: carolineResult, error: carolineError } = await supabase.functions.invoke('force-process-caroline', {
      body: {}
    });

    console.log('📝 Resultado force-process-caroline:', carolineResult);
    if (carolineError) {
      console.error('❌ Erro force-process-caroline:', carolineError);
    }

    // 4. Verificar estado final da fila
    const { data: finalQueueData, error: finalQueueError } = await supabase
      .from('message_queue')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log(`📊 Mensagens em espera após processamento: ${finalQueueData?.length || 0}`);

    return new Response(JSON.stringify({
      success: true,
      initial_queue_count: queueData?.length || 0,
      final_queue_count: finalQueueData?.length || 0,
      process_result: processResult,
      caroline_result: carolineResult,
      process_error: processError?.message || null,
      caroline_error: carolineError?.message || null
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