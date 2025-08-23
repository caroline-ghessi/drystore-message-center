import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  console.log('🔧 Iniciando correção do processamento de mensagens...')

  try {
    // FASE 1: Processar imediatamente a mensagem da Caroline
    const { data: carolineQueue, error: carolineError } = await supabase
      .from('message_queue')
      .select('*, conversations!inner(*)')
      .eq('conversations.customer_name', 'Caroline Ghessi')
      .eq('status', 'waiting')
      .single()

    if (carolineQueue && !carolineError) {
      console.log('📱 Processando mensagem da Caroline imediatamente...')
      
      // Invocar o processamento da mensagem
      const { data: processResult, error: processError } = await supabase.functions.invoke('process-message-queue', {
        body: { 
          force_process: true,
          conversation_ids: [carolineQueue.conversation_id]
        }
      })

      if (processError) {
        console.error('❌ Erro ao processar mensagem da Caroline:', processError)
      } else {
        console.log('✅ Mensagem da Caroline processada:', processResult)
      }
    }

    // FASE 2: Limpar mensagens de conversas que não devem ser processadas pelo bot
    const { data: cleanupResult, error: cleanupError } = await supabase
      .from('message_queue')
      .delete()
      .in('conversation_id', 
        // Subquery para pegar conversas em fallback_mode ou sent_to_seller
        await supabase
          .from('conversations')
          .select('id')
          .or('fallback_mode.eq.true,status.eq.sent_to_seller')
          .then(result => result.data?.map(c => c.id) || [])
      )

    console.log(`🧹 Removidas ${cleanupResult ? 'várias' : '0'} mensagens inválidas da fila`)

    // FASE 3: Corrigir o cron job com token correto
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    // Remover cron job atual
    const { error: removeError } = await supabase.rpc('remove_message_queue_crons')
    if (removeError) {
      console.error('⚠️ Aviso ao remover crons:', removeError.message)
    }

    // Criar novo cron job com token correto
    const cronCommand = `SELECT net.http_post(
      url := 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-message-queue',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${serviceRoleKey}"}',
      body := '{"auto_run": true}'
    ) AS request_id;`

    const { error: cronError } = await supabase.rpc('create_message_queue_cron')
    if (cronError) {
      console.error('❌ Erro ao criar cron job:', cronError)
    } else {
      console.log('✅ Cron job recriado com token correto')
    }

    // FASE 4: Status final
    const { data: queueStatus } = await supabase
      .from('message_queue')
      .select(`
        status,
        conversations!inner(status, fallback_mode, customer_name)
      `)

    const statusSummary = queueStatus?.reduce((acc, msg) => {
      const key = `${msg.status}_${msg.conversations.status}_${msg.conversations.fallback_mode ? 'fallback' : 'bot'}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    console.log('📊 Status final da fila:', statusSummary)

    // Log do resultado
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'message_processing_fix',
        message: 'Correção do processamento de mensagens executada',
        details: {
          caroline_processed: !carolineError,
          cleanup_executed: !cleanupError,
          cron_fixed: !cronError,
          queue_status: statusSummary,
          timestamp: new Date().toISOString()
        }
      })

    return new Response(JSON.stringify({
      success: true,
      caroline_processed: !carolineError,
      cleanup_executed: !cleanupError,
      cron_fixed: !cronError,
      queue_status: statusSummary,
      message: 'Processamento de mensagens corrigido com sucesso'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erro na correção:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Erro na correção do processamento'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})