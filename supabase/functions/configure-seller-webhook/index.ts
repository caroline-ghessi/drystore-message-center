import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConfigureWebhookRequest {
  sellerId: string;
  whapiToken: string;
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

    const { sellerId, whapiToken }: ConfigureWebhookRequest = await req.json()
    
    console.log('🔧 Configurando webhook para vendedor:', sellerId)

    // 1. Buscar dados do vendedor
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('*')
      .eq('id', sellerId)
      .single()

    if (sellerError || !seller) {
      throw new Error('Vendedor não encontrado')
    }

    // 2. Gerar URL do webhook específica para o vendedor
    const webhookUrl = `https://groqsnnytvjabgeaekkw.supabase.co/functions/v1/whapi-webhook?seller_id=${sellerId}`
    
    // 3. Configurar webhook na WHAPI Cloud
    const whapiResponse = await fetch('https://gate.whapi.cloud/settings/webhook', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${whapiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhooks: [
          {
            url: webhookUrl,
            events: {
              messages: true,
              statuses: true
            },
            mode: 'method'
          }
        ]
      })
    })

    if (!whapiResponse.ok) {
      const whapiError = await whapiResponse.text()
      console.error('❌ Erro ao configurar webhook na WHAPI:', whapiError)
      throw new Error(`Erro na WHAPI: ${whapiError}`)
    }

    const whapiResult = await whapiResponse.json()
    console.log('✅ Webhook configurado na WHAPI:', whapiResult)

    // 4. Salvar configuração no banco
    const { error: configError } = await supabase
      .from('whapi_configurations')
      .upsert({
        name: `${seller.name} - WHAPI`,
        phone_number: seller.phone_number,
        token_secret_name: `WHAPI_TOKEN_${seller.phone_number.replace(/\D/g, '')}`,
        webhook_url: webhookUrl,
        type: 'seller',
        seller_id: sellerId,
        active: true,
        health_status: 'connected',
        last_health_check: new Date().toISOString()
      }, {
        onConflict: 'seller_id',
        ignoreDuplicates: false
      })

    if (configError) {
      console.error('❌ Erro ao salvar configuração:', configError)
      throw configError
    }

    // 5. Atualizar dados do vendedor
    const { error: updateError } = await supabase
      .from('sellers')
      .update({
        whapi_webhook_url: webhookUrl,
        whapi_status: 'connected',
        whapi_last_test: new Date().toISOString(),
        whapi_token: whapiToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', sellerId)

    if (updateError) {
      console.error('❌ Erro ao atualizar vendedor:', updateError)
      throw updateError
    }

    // 6. Testar webhook enviando mensagem de boas-vindas
    const testResponse = await fetch('https://gate.whapi.cloud/messages/text', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whapiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: seller.phone_number,
        body: `🤖 Webhook configurado com sucesso!\n\nSuas mensagens agora serão monitoradas pela plataforma DryStore para garantia de qualidade.\n\n✅ Status: Conectado\n📱 Número: ${seller.phone_number}\n🔗 Webhook: ${webhookUrl}`
      })
    })

    let testResult = null
    if (testResponse.ok) {
      testResult = await testResponse.json()
      console.log('✅ Mensagem de teste enviada:', testResult)
    }

    // 7. Log de sucesso
    await supabase.from('system_logs').insert({
      type: 'success',
      source: 'webhook_configuration',
      message: 'Webhook do vendedor configurado com sucesso',
      details: {
        seller_id: sellerId,
        seller_name: seller.name,
        webhook_url: webhookUrl,
        whapi_result: whapiResult,
        test_message: testResult
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook configurado com sucesso',
        webhook_url: webhookUrl,
        seller: {
          id: sellerId,
          name: seller.name,
          phone: seller.phone_number
        },
        whapi_config: whapiResult,
        test_message: testResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error)
    
    // Log do erro
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'webhook_configuration',
      message: 'Erro ao configurar webhook do vendedor',
      details: { error: error.message, stack: error.stack }
    })

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})