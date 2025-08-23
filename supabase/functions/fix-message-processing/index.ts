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
    console.log('🔍 Buscando mensagem da Caroline...')
    
    const { data: carolineQueue, error: carolineError } = await supabase
      .from('message_queue')
      .select(`
        id,
        conversation_id,
        messages_content,
        conversations!inner(
          id,
          customer_name,
          phone_number,
          status,
          fallback_mode
        )
      `)
      .eq('conversations.customer_name', 'Caroline Ghessi')
      .eq('status', 'waiting')

    console.log('📋 Resultado busca Caroline:', { carolineQueue, carolineError })

    if (carolineQueue && carolineQueue.length > 0) {
      const caroline = carolineQueue[0]
      console.log('📱 Processando mensagem da Caroline:', caroline)
      
      // Marcar como processed primeiro
      await supabase
        .from('message_queue')
        .update({ 
          status: 'processed',
          processed_at: new Date().toISOString()
        })
        .eq('id', caroline.id)

      // Invocar process-message-queue diretamente
      const processUrl = 'https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/process-message-queue'
      const processResponse = await fetch(processUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          force_process: true,
          target_conversation: caroline.conversation_id
        })
      })

      const processResult = await processResponse.text()
      console.log('📤 Resultado processamento:', processResult)
    } else {
      console.log('⚠️ Nenhuma mensagem da Caroline encontrada')
    }

    // FASE 2: Limpar mensagens de conversas que não devem ser processadas pelo bot
    console.log('🧹 Limpando mensagens inválidas da fila...')
    
    // Buscar conversas que não devem estar na fila
    const { data: invalidConversations } = await supabase
      .from('conversations')
      .select('id')
      .or('fallback_mode.eq.true,status.eq.sent_to_seller')

    if (invalidConversations && invalidConversations.length > 0) {
      const invalidIds = invalidConversations.map(c => c.id)
      console.log(`🗑️ Removendo mensagens de ${invalidIds.length} conversas inválidas`)
      
      const { data: cleanupResult, error: cleanupError } = await supabase
        .from('message_queue')
        .delete()
        .in('conversation_id', invalidIds)

      console.log(`🧹 Resultado limpeza:`, { cleanupResult, cleanupError })
    } else {
      console.log('✅ Nenhuma mensagem inválida encontrada')
    }

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