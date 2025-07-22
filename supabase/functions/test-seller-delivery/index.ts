
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

    console.log('🎯 Iniciando teste de entrega CORRIGIDO para seller:', sellerId)

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

    console.log('👤 Vendedor encontrado:', {
      name: seller.name,
      phone: seller.phone_number
    })

    // CRÍTICO: Sempre usar o token do Rodrigo Bot (número correto: 5551981155622)
    const rodrigoBotSecretName = 'WHAPI_TOKEN_5551981155622'
    console.log('🤖 Buscando token do Rodrigo Bot:', rodrigoBotSecretName)

    const { data: rodrigoTokenResponse, error: tokenError } = await supabase.functions.invoke('get-secret', {
      body: { secretName: rodrigoBotSecretName }
    })

    if (tokenError || !rodrigoTokenResponse?.success) {
      console.error('❌ Erro ao buscar token do Rodrigo Bot:', tokenError || rodrigoTokenResponse)
      throw new Error('Token do Rodrigo Bot não encontrado')
    }

    const rodrigoToken = rodrigoTokenResponse.value
    console.log('✅ Token do Rodrigo Bot obtido:', {
      secretName: rodrigoBotSecretName,
      tokenMasked: rodrigoToken.substring(0, 10) + '...',
      tokenLength: rodrigoToken.length
    })

    // Validar que o token não está vazio
    if (!rodrigoToken || rodrigoToken.length < 10) {
      throw new Error('Token do Rodrigo Bot inválido ou muito curto')
    }

    // Preparar payload para whapi-send (FLUXO CORRIGIDO)
    const sendPayload = {
      token: rodrigoToken, // TOKEN DO RODRIGO BOT
      to: seller.phone_number, // NÚMERO DO VENDEDOR (DESTINO)
      content: `${testMessage}\n\n📋 Detalhes do teste CORRIGIDO:\n👤 Vendedor: ${seller.name}\n📱 Número: ${seller.phone_number}\n🤖 Enviado via: Rodrigo Bot (5551981155622)\n⏰ Data: ${new Date().toLocaleString('pt-BR')}\n\n🔄 FLUXO: Rodrigo Bot → Vendedor`
    }

    console.log('📤 Enviando mensagem via WHAPI (FLUXO CORRIGIDO):', {
      de: 'Rodrigo Bot (5551981155622)',
      para: `${seller.name} (${seller.phone_number})`,
      tokenUsado: rodrigoToken.substring(0, 10) + '...',
      fluxo_esperado: `5551981155622 → ${seller.phone_number}`,
      payload: {
        ...sendPayload,
        token: sendPayload.token.substring(0, 10) + '...'
      }
    })

    // Enviar mensagem via WHAPI usando o token do Rodrigo Bot
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('whapi-send', {
      body: sendPayload
    })

    if (sendError) {
      console.error('❌ Erro ao enviar mensagem:', sendError)
      throw new Error(`Erro ao enviar mensagem: ${sendError.message}`)
    }

    console.log('✅ Mensagem enviada com sucesso (FLUXO CORRIGIDO):', sendResult)

    // Log detalhado do resultado
    const resultDetails = {
      success: sendResult?.success || false,
      message_id: sendResult?.message_id,
      from: sendResult?.from || '5551981155622',
      to: sendResult?.to || seller.phone_number,
      direction: sendResult?.direction || 'bot_to_seller',
      whapi_response: sendResult?.whapi_response
    }

    console.log('📊 Detalhes do resultado CORRIGIDO:', resultDetails)

    // Log do teste no sistema
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'delivery_test',
        message: `Teste de entrega CORRIGIDO - Rodrigo Bot para ${seller.name}`,
        details: {
          seller_id: sellerId,
          seller_name: seller.name,
          seller_phone: seller.phone_number,
          test_message: testMessage,
          token_used: rodrigoBotSecretName,
          rodrigo_bot_phone: '5551981155622',
          send_result: resultDetails,
          flow_direction: 'rodrigo_bot_to_seller',
          fluxo_corrigido: `5551981155622 → ${seller.phone_number}`,
          expected_whatsapp_behavior: {
            rodrigo_bot_whatsapp: `Mensagem aparece como ENVIADA (verde) PARA ${seller.name}`,
            seller_whatsapp: `Mensagem aparece como RECEBIDA (cinza) DE Rodrigo Bot`
          }
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Teste CORRIGIDO - Rodrigo Bot → ${seller.name}`,
        details: {
          flow: "Rodrigo Bot → Vendedor (CORRIGIDO)",
          sender: "Rodrigo Bot",
          sender_phone: "5551981155622", // NÚMERO CORRIGIDO
          recipient: seller.name,
          recipient_phone: seller.phone_number,
          token_used: rodrigoBotSecretName,
          send_result: resultDetails,
          message_direction: "rodrigo_bot_to_seller",
          timestamp: new Date().toISOString(),
          fluxo_corrigido: `5551981155622 → ${seller.phone_number}`,
          expected_whatsapp_behavior: {
            rodrigo_bot_whatsapp: `Mensagem aparece como ENVIADA (verde, direita) PARA ${seller.name}`,
            seller_whatsapp: `Mensagem aparece como RECEBIDA (cinza, esquerda) DE Rodrigo Bot`
          },
          verificacoes_necessarias: [
            `1. No WhatsApp do Rodrigo Bot (5551981155622): Deve mostrar mensagem ENVIADA para ${seller.name}`,
            `2. No WhatsApp do vendedor (${seller.phone_number}): Deve mostrar mensagem RECEBIDA do Rodrigo Bot`,
            "3. Logs devem mostrar direction: 'bot_to_seller'",
            "4. phone_from deve ser 5551981155622, phone_to deve ser o número do vendedor"
          ]
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Erro no teste de entrega:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: {
          message: "Falha no teste de entrega CORRIGIDO",
          expected_flow: "Rodrigo Bot (5551981155622) → Vendedor",
          troubleshooting: {
            check_token: "Verificar se WHAPI_TOKEN_5551981155622 está correto",
            check_rodrigo_bot: "Verificar se número 5551981155622 está ativo no WHAPI",
            check_seller_phone: "Verificar se número do vendedor está correto",
            check_flow: "Confirmar que mensagem vai DO Rodrigo Bot PARA o vendedor"
          }
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
})
