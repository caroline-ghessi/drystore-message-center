import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestDeliveryRequest {
  sellerId: string;
  testMessage?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sellerId, testMessage = "✅ Teste de entrega - WhatsApp funcionando!" }: TestDeliveryRequest = await req.json()

    if (!sellerId) {
      throw new Error('sellerId é obrigatório')
    }

    // Buscar dados do vendedor
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('name, phone_number, whapi_token')
      .eq('id', sellerId)
      .single()

    if (sellerError || !seller) {
      throw new Error(`Vendedor não encontrado: ${sellerError?.message}`)
    }

    if (!seller.whapi_token) {
      throw new Error('Token WHAPI não configurado para este vendedor')
    }

    // Buscar token do Rodrigo Bot
    const { data: rodrigoToken } = await supabase.functions.invoke('get-secret', {
      body: { secretName: 'WHAPI_TOKEN_5551981155622' }
    })

    if (!rodrigoToken?.value) {
      throw new Error('Token do Rodrigo Bot não encontrado')
    }

    // Enviar mensagem de teste via WHAPI
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('whapi-send', {
      body: {
        token: rodrigoToken.value,
        to: seller.phone_number,
        content: `${testMessage}\n\nVendedor: ${seller.name}\nNúmero: ${seller.phone_number}`
      }
    })

    if (sendError) {
      throw new Error(`Erro ao enviar mensagem: ${sendError.message}`)
    }

    // Log do teste
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'delivery_test',
        message: `Teste de entrega enviado para ${seller.name}`,
        details: {
          seller_id: sellerId,
          seller_name: seller.name,
          phone_number: seller.phone_number,
          test_message: testMessage,
          result: sendResult
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Teste enviado para ${seller.name}`,
        details: {
          seller_name: seller.name,
          phone_number: seller.phone_number,
          send_result: sendResult
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Erro no teste de entrega:', error)
    
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