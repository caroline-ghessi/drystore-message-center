
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("🤖 WHAPI Monitor de mensagens pendentes inicializado")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar mensagens pendentes há mais de 30 segundos
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()
    
    // Obter mensagens enviadas ou pendentes que precisam de verificação
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('whapi_logs')
      .select(`
        id,
        whapi_message_id,
        token_used,
        phone_to,
        phone_from,
        status,
        created_at,
        sellers!inner(name, phone_number)
      `)
      .in('status', ['sent', 'pending'])  // Verificar tanto mensagens enviadas quanto pendentes
      .lt('created_at', thirtySecondsAgo)
      .not('whapi_message_id', 'is', null)

    if (fetchError) {
      throw fetchError
    }

    const checkedMessages = []
    const failedChecks = []

    for (const message of pendingMessages || []) {
      try {
        // Verificar status na API WHAPI - usando endpoint correto para status e autenticação padronizada
        const statusResponse = await fetch(`https://gate.whapi.cloud/statuses/${message.whapi_message_id}?token=${message.token_used}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        })

        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          
          // Mapear status do WHAPI para nosso sistema
          let newStatus = message.status
          let errorMessage = null

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
              const sentTime = new Date(message.created_at).getTime()
              const now = Date.now()
              const minutesElapsed = (now - sentTime) / (1000 * 60)
              
              if (minutesElapsed > 15 && statusData.status === 'pending') {
                newStatus = 'failed'
                errorMessage = 'Mensagem pendente por muito tempo - possível número inválido'
              }
          }

          // Atualizar status no banco
          const updateData: any = { status: newStatus }
          if (errorMessage) {
            updateData.error_message = errorMessage
          }

          await supabase
            .from('whapi_logs')
            .update({
              ...updateData,
              metadata: {
                ...statusData,
                auto_status_check: true,
                last_checked: new Date().toISOString()
              }
            })
            .eq('id', message.id)

          checkedMessages.push({
            id: message.id,
            whapi_message_id: message.whapi_message_id,
            old_status: 'sent',
            new_status: newStatus,
            seller_name: message.sellers?.name
          })

          // Se ainda estiver failed após 30 segundos, alertar
          if (newStatus === 'failed') {
            await supabase
              .from('system_logs')
              .insert({
                type: 'warning',
                source: 'whapi_monitor',
                message: `Mensagem falhada detectada para ${message.sellers?.name}`,
                details: {
                  message_id: message.whapi_message_id,
                  seller_phone: message.phone_to,
                  seller_name: message.sellers?.name,
                  failure_reason: errorMessage || 'Desconhecido'
                }
              })
          }
        } else {
          console.error('Erro WHAPI:', statusResponse.status, await statusResponse.text())
          failedChecks.push({
            id: message.id,
            error: `HTTP ${statusResponse.status}`
          })
        }
      } catch (error) {
        console.error('Erro ao verificar mensagem:', message.id, error)
        failedChecks.push({
          id: message.id,
          error: error.message
        })
      }

      // Pequeno delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Log do monitoramento
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'whapi_monitor',
        message: `Monitoramento automático executado: ${checkedMessages.length} verificadas, ${failedChecks.length} erros`,
        details: {
          checked_messages: checkedMessages,
          failed_checks: failedChecks,
          total_pending: pendingMessages?.length || 0
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        checked_count: checkedMessages.length,
        error_count: failedChecks.length,
        checked_messages: checkedMessages,
        failed_checks: failedChecks
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro no monitoramento automático:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro no monitoramento automático',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
