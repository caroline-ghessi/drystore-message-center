import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('whapi_logs')
      .select(`
        id,
        whapi_message_id,
        token_used,
        phone_to,
        status,
        created_at,
        sellers!inner(name, phone_number)
      `)
      .eq('status', 'sent')
      .lt('created_at', thirtySecondsAgo)
      .not('whapi_message_id', 'is', null)

    if (fetchError) {
      throw fetchError
    }

    const checkedMessages = []
    const failedChecks = []

    for (const message of pendingMessages || []) {
      try {
        // Verificar status na API WHAPI
        const statusResponse = await fetch(`https://gate.whapi.cloud/messages/${message.whapi_message_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${message.token_used}`,
            'Content-Type': 'application/json'
          }
        })

        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          
          // Atualizar status no banco
          await supabase
            .from('whapi_logs')
            .update({ 
              status: statusData.status || 'unknown',
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
            new_status: statusData.status,
            seller_name: message.sellers?.name
          })

          // Se ainda estiver failed após 30 segundos, alertar
          if (statusData.status === 'failed') {
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
                  failure_reason: statusData.error || 'Desconhecido'
                }
              })
          }
        } else {
          failedChecks.push({
            id: message.id,
            error: `HTTP ${statusResponse.status}`
          })
        }
      } catch (error) {
        failedChecks.push({
          id: message.id,
          error: error.message
        })
      }
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