import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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

    console.log('🔍 Verificando status dos webhooks dos vendedores...')

    // 1. Buscar todos os vendedores ativos
    const { data: sellers, error: sellersError } = await supabase
      .from('sellers')
      .select('*')
      .eq('active', true)
      .eq('deleted', false)

    if (sellersError) {
      throw sellersError
    }

    const results = []

    // 2. Verificar cada vendedor
    for (const seller of sellers || []) {
      console.log(`🔧 Verificando vendedor: ${seller.name} (${seller.phone_number})`)
      
      let status = 'disconnected'
      let webhookConfigured = false
      let lastMessageReceived = null
      let configDetails = null
      let whapiError = null

      try {
        // Verificar se tem configuração WHAPI
        const { data: config } = await supabase
          .from('whapi_configurations')
          .select('*')
          .eq('seller_id', seller.id)
          .single()

        if (config) {
          configDetails = config
          webhookConfigured = true

          // Testar conectividade com WHAPI se tiver token
          if (seller.whapi_token) {
            const whapiResponse = await fetch('https://gate.whapi.cloud/settings/webhook', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${seller.whapi_token}`,
                'Content-Type': 'application/json',
              }
            })

            if (whapiResponse.ok) {
              const whapiConfig = await whapiResponse.json()
              const hasCorrectWebhook = whapiConfig.webhooks?.some((webhook: any) => 
                webhook.url.includes(seller.id)
              )
              
              if (hasCorrectWebhook) {
                status = 'connected'
              } else {
                status = 'misconfigured'
                whapiError = 'Webhook URL não encontrada ou incorreta'
              }
            } else {
              status = 'error'
              whapiError = 'Erro de conexão com WHAPI'
            }
          }
        }

        // Verificar última mensagem recebida do vendedor
        const { data: lastMessage } = await supabase
          .from('whapi_logs')
          .select('*')
          .eq('seller_id', seller.id)
          .eq('direction', 'sent')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (lastMessage) {
          lastMessageReceived = lastMessage.created_at
        }

        // Atualizar status do vendedor
        await supabase
          .from('sellers')
          .update({
            whapi_status: status,
            whapi_error_message: whapiError,
            updated_at: new Date().toISOString()
          })
          .eq('id', seller.id)

      } catch (error) {
        console.error(`❌ Erro ao verificar vendedor ${seller.name}:`, error)
        status = 'error'
        whapiError = error.message
      }

      results.push({
        seller_id: seller.id,
        seller_name: seller.name,
        phone_number: seller.phone_number,
        status,
        webhook_configured: webhookConfigured,
        last_message_received: lastMessageReceived,
        config_details: configDetails,
        error: whapiError
      })
    }

    // 3. Classificar resultados
    const summary = {
      total_sellers: results.length,
      connected: results.filter(r => r.status === 'connected').length,
      disconnected: results.filter(r => r.status === 'disconnected').length,
      misconfigured: results.filter(r => r.status === 'misconfigured').length,
      errors: results.filter(r => r.status === 'error').length
    }

    // 4. Log do resultado
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'webhook_verification',
      message: 'Verificação de webhooks dos vendedores concluída',
      details: {
        summary,
        results: results
      }
    })

    console.log('✅ Verificação concluída:', summary)

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        sellers: results,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro na verificação de webhooks:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})