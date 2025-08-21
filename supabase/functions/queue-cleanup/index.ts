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

    console.log('🧹 Iniciando limpeza da fila de mensagens...');

    let totalCleaned = 0;

    // 1. Remove mensagens antigas já processadas (mais de 6 horas)
    const { count: oldProcessed } = await supabase
      .from('message_queue')
      .delete({ count: 'exact' })
      .in('status', ['sent', 'failed'])
      .lt('processed_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());

    totalCleaned += oldProcessed || 0;
    console.log(`✅ Removidas ${oldProcessed || 0} mensagens antigas processadas`);

    // 2. Marca mensagens órfãs como falha (conversas que não existem mais)
    const { data: orphanMessages } = await supabase
      .from('message_queue')
      .select('id, conversation_id')
      .eq('status', 'waiting');

    if (orphanMessages && orphanMessages.length > 0) {
      for (const msg of orphanMessages) {
        const { data: conversation } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', msg.conversation_id)
          .single();

        if (!conversation) {
          await supabase
            .from('message_queue')
            .update({ 
              status: 'failed',
              processed_at: new Date().toISOString(),
              last_error: 'Conversa não encontrada - limpeza automática'
            })
            .eq('id', msg.id);
          
          totalCleaned++;
        }
      }
      console.log(`✅ Marcadas ${totalCleaned - (oldProcessed || 0)} mensagens órfãs como falha`);
    }

    // 3. Reseta retry_count de mensagens antigas em 'waiting' para dar nova chance
    const { count: resetRetries } = await supabase
      .from('message_queue')
      .update({ 
        retry_count: 0,
        last_error: null,
        scheduled_for: new Date(Date.now() + 30000).toISOString() // Reagenda para 30 segundos
      }, { count: 'exact' })
      .eq('status', 'waiting')
      .gt('retry_count', 0)
      .lt('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()); // Mais de 2 horas

    console.log(`🔄 Resetados retry_count de ${resetRetries || 0} mensagens antigas`);

    // 4. Estatísticas da fila
    const { data: queueStats } = await supabase
      .from('message_queue')
      .select('status')
      .then(({ data }) => {
        const stats = { waiting: 0, processing: 0, sent: 0, failed: 0 };
        data?.forEach(item => {
          stats[item.status as keyof typeof stats] = (stats[item.status as keyof typeof stats] || 0) + 1;
        });
        return { data: stats };
      });

    // Log de resultado
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'queue_cleanup',
      message: 'Limpeza automática da fila executada',
      details: {
        total_cleaned: totalCleaned,
        old_processed_removed: oldProcessed || 0,
        retries_reset: resetRetries || 0,
        queue_stats: queueStats,
        timestamp: new Date().toISOString()
      }
    });

    const result = {
      success: true,
      total_cleaned: totalCleaned,
      old_processed_removed: oldProcessed || 0,
      retries_reset: resetRetries || 0,
      current_queue_stats: queueStats,
      message: `Limpeza concluída: ${totalCleaned} itens processados`
    };

    console.log('🎯 Limpeza concluída:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro na limpeza da fila:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});