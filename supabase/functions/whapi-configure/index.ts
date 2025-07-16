import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConfigureWebhookRequest {
  token: string;
  webhookUrl: string;
  sellerId?: string;
  type: 'rodrigo_bot' | 'seller';
  phoneNumber: string;
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

    const request: ConfigureWebhookRequest = await req.json()
    console.log('Configurando webhook WHAPI:', request)

    // Validar dados
    if (!request.token || !request.webhookUrl || !request.phoneNumber) {
      throw new Error('Token, webhook URL e número de telefone são obrigatórios')
    }

    // 1. Testar conectividade com WHAPI
    const healthResponse = await fetch(`https://gate.whapi.cloud/health?token=${request.token}`)
    
    if (!healthResponse.ok) {
      throw new Error('Token WHAPI inválido ou inativo')
    }

    const healthData = await healthResponse.json()
    console.log('Health check WHAPI:', healthData)

    // 2. Configurar webhook
    const webhookSettings = {
      webhooks: [{
        url: request.webhookUrl,
        events: [
          { type: 'messages', method: 'post' },
          { type: 'messages', method: 'patch' },
          { type: 'statuses', method: 'post' }
        ],
        mode: 'body'
      }],
      callback_persist: true,
      callback_backoff_delay_ms: 3000,
      max_callback_backoff_delay_ms: 900000
    }

    const webhookResponse = await fetch(`https://gate.whapi.cloud/settings?token=${request.token}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(webhookSettings)
    })

    if (!webhookResponse.ok) {
      const errorData = await webhookResponse.json()
      throw new Error(`Erro ao configurar webhook: ${errorData.message || webhookResponse.statusText}`)
    }

    const webhookData = await webhookResponse.json()
    console.log('Webhook configurado:', webhookData)

    // 3. Salvar/atualizar configuração no banco
    const configData = {
      name: request.type === 'rodrigo_bot' ? 'Rodrigo Bot' : `Vendedor ${request.phoneNumber}`,
      phone_number: request.phoneNumber,
      token_secret_name: `WHAPI_TOKEN_${request.phoneNumber.replace(/\D/g, '')}`,
      webhook_url: request.webhookUrl,
      type: request.type,
      seller_id: request.sellerId || null,
      last_health_check: new Date().toISOString(),
      health_status: 'healthy'
    }

    // Upsert na tabela whapi_configurations
    const { data: configResult, error: configError } = await supabase
      .from('whapi_configurations')
      .upsert(configData, { 
        onConflict: 'phone_number',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (configError) {
      console.error('Erro ao salvar configuração:', configError)
      throw new Error('Erro ao salvar configuração no banco de dados')
    }

    // 4. Atualizar vendedor se for do tipo seller
    if (request.type === 'seller' && request.sellerId) {
      const { error: sellerError } = await supabase
        .from('sellers')
        .update({
          whapi_webhook_url: request.webhookUrl,
          whapi_status: 'connected',
          whapi_last_test: new Date().toISOString(),
          whapi_error_message: null
        })
        .eq('id', request.sellerId)

      if (sellerError) {
        console.error('Erro ao atualizar vendedor:', sellerError)
      }
    }

    // 5. Enviar mensagem de teste
    const testMessage = request.type === 'rodrigo_bot' 
      ? '🤖 Rodrigo Bot WHAPI configurado com sucesso!' 
      : `👋 Webhook WHAPI configurado para o vendedor ${request.phoneNumber}`

    try {
      const testResponse = await fetch(`https://gate.whapi.cloud/messages/text?token=${request.token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: request.phoneNumber,
          body: testMessage
        })
      })

      if (testResponse.ok) {
        console.log('Mensagem de teste enviada com sucesso')
      }
    } catch (testError) {
      console.log('Não foi possível enviar mensagem de teste:', testError)
    }

    // Log de sucesso
    await supabase.from('system_logs').insert({
      type: 'success',
      source: 'whapi-configure',
      message: `Webhook WHAPI configurado para ${request.type}`,
      details: {
        phone_number: request.phoneNumber,
        type: request.type,
        webhook_url: request.webhookUrl,
        health_status: healthData
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        configuration: configResult,
        health: healthData,
        webhook: webhookData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro na configuração WHAPI:', error)

    // Log do erro
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'whapi-configure',
      message: 'Erro ao configurar WHAPI',
      details: { 
        error: error.message,
        stack: error.stack 
      }
    })

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