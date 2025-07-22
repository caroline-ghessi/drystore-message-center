
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckStatusRequest {
  messageId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { messageId }: CheckStatusRequest = await req.json()

    if (!messageId) {
      throw new Error('messageId é obrigatório')
    }

    // Buscar a mensagem no log
    const { data: logEntry, error: logError } = await supabase
      .from('whapi_logs')
      .select('*')
      .eq('id', messageId)
      .single()

    if (logError || !logEntry) {
      throw new Error(`Mensagem não encontrada: ${logError?.message}`)
    }

    console.log('Verificando status da mensagem:', {
      id: logEntry.id,
      whapi_message_id: logEntry.whapi_message_id,
      current_status: logEntry.status
    })

    // Se não temos whapi_message_id, não podemos verificar
    if (!logEntry.whapi_message_id) {
      await supabase
        .from('whapi_logs')
        .update({ 
          status: 'failed',
          error_message: 'Mensagem sem ID do WHAPI - possível falha no envio'
        })
        .eq('id', messageId)

      return new Response(
        JSON.stringify({
          success: true,
          status: 'failed',
          reason: 'Mensagem sem ID do WHAPI'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar token para verificar status no WHAPI
    const { data: tokenData } = await supabase.functions.invoke('get-secret', {
      body: { secretName: 'WHAPI_TOKEN_5551981155622' }
    })

    if (!tokenData?.value) {
      throw new Error('Token WHAPI não encontrado')
    }

    // Verificar status no WHAPI - usando endpoint correto para status
    const statusUrl = `https://gate.whapi.cloud/statuses/${logEntry.whapi_message_id}?token=${tokenData.value}`
    
    console.log('Consultando WHAPI:', statusUrl)

    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })

    const statusData = await response.json()
    console.log('Resposta WHAPI status:', statusData)

    let newStatus = logEntry.status
    let errorMessage = null

    if (response.ok && statusData) {
      // Mapear status do WHAPI para nosso sistema
      switch (statusData.status) {
        case 'sent':
        case 'pending':
          newStatus = 'pending'
          break
        case 'delivered':
          newStatus = 'delivered'
          break
        case 'read':
          newStatus = 'read'
          break
        case 'failed':
          newStatus = 'failed'
          errorMessage = statusData.error || 'Falha reportada pelo WHAPI'
          break
        default:
          // Se status for "pending" por muito tempo (>15 min), marcar como suspeito
          const sentTime = new Date(logEntry.created_at).getTime()
          const now = Date.now()
          const minutesElapsed = (now - sentTime) / (1000 * 60)
          
          if (minutesElapsed > 15 && statusData.status === 'pending') {
            newStatus = 'failed'
            errorMessage = 'Mensagem pendente por muito tempo - possível número inválido'
          }
      }
    } else {
      console.error('Erro ao consultar WHAPI:', response.status, statusData)
      errorMessage = `Erro WHAPI: ${response.status}`
    }

    // Atualizar status no banco se mudou
    if (newStatus !== logEntry.status || errorMessage) {
      const updateData: any = { status: newStatus }
      if (errorMessage) {
        updateData.error_message = errorMessage
      }

      await supabase
        .from('whapi_logs')
        .update(updateData)
        .eq('id', messageId)

      console.log('Status atualizado:', { messageId, oldStatus: logEntry.status, newStatus, errorMessage })
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        whapi_response: statusData,
        changed: newStatus !== logEntry.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro ao verificar status:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
})
