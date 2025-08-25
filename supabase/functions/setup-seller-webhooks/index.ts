import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SetupRequest {
  sellerId?: string;
  testMode?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { sellerId, testMode = false }: SetupRequest = await req.json()

    console.log('🔧 Configurando webhooks WHAPI para vendedores...')

    const results = {
      success: 0,
      failed: 0,
      details: [],
      errors: []
    }

    // Buscar configurações WHAPI dos vendedores que precisam ser ativadas
    const query = supabase
      .from('whapi_configurations')
      .select(`
        id,
        name,
        phone_number,
        token_secret_name,
        webhook_url,
        type,
        seller_id,
        active,
        health_status,
        sellers!whapi_configurations_seller_id_fkey (
          id, name, phone_number, active
        )
      `)
      .eq('type', 'seller')
      .eq('active', true)

    if (sellerId) {
      query.eq('seller_id', sellerId)
    }

    const { data: configurations } = await query

    console.log(`📋 Encontradas ${configurations?.length || 0} configurações para processar`)

    for (const config of configurations || []) {
      try {
        console.log(`🔄 Configurando webhook para ${config.sellers.name}...`)

        // Obter token de forma segura
        const { data: tokenData } = await supabase.functions.invoke('get-whapi-token', {
          body: { 
            tokenSecretName: config.token_secret_name,
            sellerId: config.seller_id,
            requesterType: 'webhook_setup'
          }
        })

        if (!tokenData?.success || !tokenData?.token) {
          throw new Error(`Token não acessível: ${config.token_secret_name}`)
        }

        // Configurar webhook no WHAPI Cloud
        const webhookUrl = `https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook?seller_id=${config.seller_id}`
        
        console.log(`📡 Configurando webhook: ${webhookUrl}`)

        const whapiResponse = await fetch(`https://gate.whapi.cloud/settings/webhook`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenData.token}`
          },
          body: JSON.stringify({
            webhooks: [{
              url: webhookUrl,
              events: [
                'messages',
                'statuses',
                'chats'
              ],
              mode: 'body'
            }]
          })
        })

        if (!whapiResponse.ok) {
          const errorText = await whapiResponse.text()
          throw new Error(`WHAPI Error ${whapiResponse.status}: ${errorText}`)
        }

        const whapiData = await whapiResponse.json()
        console.log(`✅ Webhook configurado para ${config.sellers.name}:`, whapiData)

        // Atualizar status na configuração
        await supabase
          .from('whapi_configurations')
          .update({
            health_status: 'healthy',
            last_health_check: new Date().toISOString(),
            webhook_url: webhookUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', config.id)

        // Atualizar status do vendedor
        await supabase
          .from('sellers')
          .update({
            whapi_status: 'connected',
            whapi_webhook_url: webhookUrl,
            whapi_last_test: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', config.seller_id)

        // Teste opcional: enviar mensagem de confirmação
        if (testMode) {
          const testMessage = `✅ *Webhook WHAPI Configurado!*

Olá ${config.sellers.name}! 

Seu WhatsApp foi conectado com sucesso à plataforma Drystore. Agora todas as suas conversas com clientes serão monitoradas para garantir a qualidade do atendimento.

Suas mensagens aparecerão no painel de acompanhamento em tempo real.

_Mensagem automática do sistema_`

          const testResponse = await fetch(`https://gate.whapi.cloud/messages/text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenData.token}`
            },
            body: JSON.stringify({
              to: config.phone_number,
              body: testMessage
            })
          })

          if (testResponse.ok) {
            console.log(`📱 Mensagem de teste enviada para ${config.sellers.name}`)
          }
        }

        results.success++
        results.details.push({
          seller_name: config.sellers.name,
          phone_number: config.phone_number,
          webhook_configured: true,
          status: 'success'
        })

      } catch (error) {
        console.error(`❌ Erro ao configurar ${config.sellers.name}:`, error)
        results.failed++
        results.errors.push({
          seller_name: config.sellers.name,
          phone_number: config.phone_number,
          error: error.message
        })

        // Marcar configuração como não saudável
        await supabase
          .from('whapi_configurations')
          .update({
            health_status: 'unhealthy',
            last_health_check: new Date().toISOString()
          })
          .eq('id', config.id)
      }
    }

    // Log final do processo
    await supabase.from('system_logs').insert({
      type: results.failed > 0 ? 'warning' : 'info',
      source: 'whapi',
      message: 'Setup de webhooks WHAPI para vendedores',
      details: {
        total_processed: configurations?.length || 0,
        success_count: results.success,
        failed_count: results.failed,
        test_mode: testMode,
        seller_specific: !!sellerId,
        results
      }
    })

    console.log(`🎯 Setup finalizado: ${results.success} sucessos, ${results.failed} falhas`)

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_configurations: configurations?.length || 0,
          successful_setups: results.success,
          failed_setups: results.failed
        },
        details: results.details,
        errors: results.errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro crítico no setup:', error)

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