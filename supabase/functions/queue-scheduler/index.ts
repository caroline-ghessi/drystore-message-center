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

    console.log('⏰ Iniciando agendamento da fila de mensagens...');

    // Chama o processador de mensagens em loop a cada 15 segundos
    const processQueue = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('process-message-queue');
        
        if (error) {
          console.error('❌ Erro ao processar fila:', error);
        } else {
          console.log('✅ Fila processada:', data);
        }
      } catch (error) {
        console.error('❌ Erro inesperado no processamento da fila:', error);
      }
    };

    // Processa imediatamente
    await processQueue();

    // Agenda processamento a cada 15 segundos
    const interval = setInterval(processQueue, 15000);

    // Limpeza quando a função é encerrada
    addEventListener('beforeunload', () => {
      console.log('🛑 Parando agendador da fila...');
      clearInterval(interval);
    });

    // Resposta de confirmação
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Queue scheduler started - processing every 15 seconds'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no agendador da fila:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});