
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestDeliveryRequest {
  sellerId: string;
  testMessage?: string;
}

// Função para normalizar números brasileiros para WHAPI
function normalizePhoneForWhapi(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  cleaned = cleaned.replace(/^0+/, '');
  
  if (!cleaned.startsWith('55')) {
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }
  }
  
  if (!cleaned.startsWith('55') || cleaned.length < 12 || cleaned.length > 13) {
    throw new Error(`Número brasileiro inválido: ${phone}`);
  }
  
  const countryCode = cleaned.substring(0, 2);
  const areaCode = cleaned.substring(2, 4);
  const number = cleaned.substring(4);
  
  // Se é celular com 9º dígito (novo formato), remove o 9
  if (number.length === 9 && number.startsWith('9')) {
    const normalizedNumber = number.substring(1);
    const result = countryCode + areaCode + normalizedNumber;
    
    console.log('📱 NORMALIZAÇÃO: Removendo 9º dígito para WHAPI:', {
      original: `${countryCode}${areaCode}${number}`,
      normalized: result,
      explanation: 'WHAPI usa formato antigo (sem 9º dígito)'
    });
    
    return result;
  }
  
  return cleaned;
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

    console.log('🎯 Iniciando teste de entrega COM NORMALIZAÇÃO para seller:', sellerId)

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar dados do vendedor
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
      phone_original: seller.phone_number
    })

    // APLICAR NORMALIZAÇÃO NO NÚMERO DO VENDEDOR
    let normalizedSellerPhone: string
    try {
      normalizedSellerPhone = normalizePhoneForWhapi(seller.phone_number)
      console.log('📱 Número do vendedor normalizado para WHAPI:', {
        original: seller.phone_number,
        normalized: normalizedSellerPhone,
        aplicou_normalizacao: seller.phone_number !== normalizedSellerPhone
      })
    } catch (error) {
      throw new Error(`Erro ao normalizar número do vendedor: ${error.message}`)
    }

    // Usar token do Rodrigo Bot
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

    if (!rodrigoToken || rodrigoToken.length < 10) {
      throw new Error('Token do Rodrigo Bot inválido ou muito curto')
    }

    // Preparar payload para whapi-send (COM NORMALIZAÇÃO)
    const sendPayload = {
      token: rodrigoToken,
      to: normalizedSellerPhone, // USAR NÚMERO NORMALIZADO
      content: `${testMessage}\n\n📋 Detalhes do teste COM NORMALIZAÇÃO:\n👤 Vendedor: ${seller.name}\n📱 Número original: ${seller.phone_number}\n📱 Número normalizado: ${normalizedSellerPhone}\n🤖 Enviado via: Rodrigo Bot (5551981155622)\n⏰ Data: ${new Date().toLocaleString('pt-BR')}\n\n🔄 FLUXO CORRIGIDO: Rodrigo Bot → Vendedor (formato WHAPI compatível)\n\n✅ CORREÇÃO: Removido 9º dígito para compatibilidade WHAPI`
    }

    console.log('📤 Enviando mensagem via WHAPI (COM NORMALIZAÇÃO):', {
      de: 'Rodrigo Bot (5551981155622)',
      para: `${seller.name}`,
      numero_original: seller.phone_number,
      numero_normalizado: normalizedSellerPhone,
      normalizacao_aplicada: seller.phone_number !== normalizedSellerPhone,
      tokenUsado: rodrigoToken.substring(0, 10) + '...',
      fluxo_esperado: `5551981155622 → ${normalizedSellerPhone}`
    })

    // Enviar mensagem via WHAPI
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('whapi-send', {
      body: sendPayload
    })

    if (sendError) {
      console.error('❌ Erro ao enviar mensagem:', sendError)
      throw new Error(`Erro ao enviar mensagem: ${sendError.message}`)
    }

    console.log('✅ Mensagem enviada com sucesso (COM NORMALIZAÇÃO):', sendResult)

    const resultDetails = {
      success: sendResult?.success || false,
      message_id: sendResult?.message_id,
      from: sendResult?.from || '5551981155622',
      to: sendResult?.to || normalizedSellerPhone,
      original_to: seller.phone_number,
      direction: sendResult?.direction || 'bot_to_seller',
      normalizacao_aplicada: sendResult?.normalizacao_aplicada || false,
      whapi_response: sendResult?.whapi_response
    }

    console.log('📊 Detalhes do resultado COM NORMALIZAÇÃO:', resultDetails)

    // Log do teste no sistema
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'delivery_test',
        message: `Teste de entrega COM NORMALIZAÇÃO - Rodrigo Bot para ${seller.name}`,
        details: {
          seller_id: sellerId,
          seller_name: seller.name,
          seller_phone_original: seller.phone_number,
          seller_phone_normalized: normalizedSellerPhone,
          normalizacao_aplicada: seller.phone_number !== normalizedSellerPhone,
          test_message: testMessage,
          token_used: rodrigoBotSecretName,
          rodrigo_bot_phone: '5551981155622',
          send_result: resultDetails,
          flow_direction: 'rodrigo_bot_to_seller',
          fluxo_corrigido: `5551981155622 → ${normalizedSellerPhone}`,
          explicacao_normalizacao: 'Removido 9º dígito para compatibilidade com WHAPI'
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Teste COM NORMALIZAÇÃO - Rodrigo Bot → ${seller.name}`,
        details: {
          flow: "Rodrigo Bot → Vendedor (COM NORMALIZAÇÃO)",
          sender: "Rodrigo Bot",
          sender_phone: "5551981155622",
          recipient: seller.name,
          recipient_phone_original: seller.phone_number,
          recipient_phone_normalized: normalizedSellerPhone,
          normalizacao_aplicada: seller.phone_number !== normalizedSellerPhone,
          explicacao_normalizacao: seller.phone_number !== normalizedSellerPhone ? 
            `Número ${seller.phone_number} foi normalizado para ${normalizedSellerPhone} (removido 9º dígito)` : 
            'Número já estava no formato correto',
          token_used: rodrigoBotSecretName,
          send_result: resultDetails,
          message_direction: "rodrigo_bot_to_seller",
          timestamp: new Date().toISOString(),
          fluxo_corrigido: `5551981155622 → ${normalizedSellerPhone}`,
          expected_whatsapp_behavior: {
            rodrigo_bot_whatsapp: `Mensagem aparece como ENVIADA (verde, direita) PARA ${seller.name}`,
            seller_whatsapp: `Mensagem aparece como RECEBIDA (cinza, esquerda) DE Rodrigo Bot`,
            correcao_aplicada: "Número normalizado para formato WHAPI compatível (sem 9º dígito)"
          },
          verificacoes_necessarias: [
            `1. No WhatsApp do Rodrigo Bot (5551981155622): Deve mostrar mensagem ENVIADA para ${seller.name}`,
            `2. No WhatsApp do vendedor (${seller.phone_number}): Deve mostrar mensagem RECEBIDA do Rodrigo Bot`,
            "3. Logs devem mostrar direction: 'bot_to_seller'",
            `4. phone_from deve ser 5551981155622, phone_to deve ser ${normalizedSellerPhone} (normalizado)`
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
          message: "Falha no teste de entrega COM NORMALIZAÇÃO",
          expected_flow: "Rodrigo Bot (5551981155622) → Vendedor (número normalizado)",
          troubleshooting: {
            check_token: "Verificar se WHAPI_TOKEN_5551981155622 está correto",
            check_rodrigo_bot: "Verificar se número 5551981155622 está ativo no WHAPI",
            check_seller_phone: "Verificar se número do vendedor está correto",
            check_normalization: "Verificar se normalização está funcionando (remoção do 9º dígito)",
            check_flow: "Confirmar que mensagem vai DO Rodrigo Bot PARA o vendedor (número normalizado)"
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
