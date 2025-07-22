
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WhapiSendRequest {
  token: string;
  to: string;
  content: string;
  type?: 'text' | 'media';
  media?: {
    url?: string;
    base64?: string;
    filename?: string;
    caption?: string;
    type?: 'image' | 'video' | 'audio' | 'document';
  };
  buttons?: Array<{
    id: string;
    text: string;
  }>;
  quoted?: string;
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
  
  console.log('🔍 Normalizando número para WHAPI:', {
    original: phone,
    countryCode,
    areaCode,
    number,
    numberLength: number.length
  });
  
  // Se é celular com 9º dígito (novo formato), remove o 9
  if (number.length === 9 && number.startsWith('9')) {
    const normalizedNumber = number.substring(1);
    const result = countryCode + areaCode + normalizedNumber;
    
    console.log('📱 CORREÇÃO: Removendo 9º dígito para compatibilidade WHAPI:', {
      original: `${countryCode}${areaCode}${number}`,
      normalized: result,
      explanation: 'WHAPI usa formato antigo (sem 9º dígito)'
    });
    
    return result;
  }
  
  console.log('📞 Número já no formato correto para WHAPI:', cleaned);
  return cleaned;
}

function validatePhoneNumber(phone: string): { isValid: boolean; formatted: string; warnings: string[] } {
  const warnings: string[] = []
  let cleaned = phone.replace(/\D/g, '')

  if (!cleaned) {
    return { isValid: false, formatted: '', warnings: ['Número vazio'] }
  }

  cleaned = cleaned.replace(/^0+/, '')

  if (!cleaned.startsWith('55')) {
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      cleaned = '55' + cleaned
      warnings.push('Código do país (55) adicionado automaticamente')
    } else {
      warnings.push('Número com formato suspeito')
    }
  }

  if (cleaned.length < 12 || cleaned.length > 13) {
    warnings.push(`Comprimento inválido: ${cleaned.length} dígitos`)
    return { isValid: false, formatted: cleaned, warnings }
  }

  if (!cleaned.startsWith('55')) {
    warnings.push('Não é um número brasileiro')
    return { isValid: false, formatted: cleaned, warnings }
  }

  const ddd = cleaned.substring(2, 4)
  if (parseInt(ddd) < 11 || parseInt(ddd) > 99) {
    warnings.push(`DDD inválido: ${ddd}`)
    return { isValid: false, formatted: cleaned, warnings }
  }

  const numberPart = cleaned.substring(4)
  if (numberPart.length === 9 && !numberPart.startsWith('9')) {
    warnings.push('Número pode ser fixo - WhatsApp funciona apenas com celulares')
  }

  return { isValid: true, formatted: cleaned, warnings }
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

    const request: WhapiSendRequest = await req.json()
    
    const tokenMasked = request.token.substring(0, 10) + '...'
    
    console.log('📨 WHAPI Send request recebido:', {
      token: tokenMasked,
      to: request.to,
      content: request.content.substring(0, 50) + '...',
      type: request.type || 'text'
    })

    // Identificar qual número está enviando baseado no token
    let senderPhone = 'unknown'
    let tokenSecretName = 'unknown'
    let direction = 'unknown'

    // Verificar se é o token do Rodrigo Bot
    if (request.token.length > 20) {
      const rodrigoBotToken = Deno.env.get('WHAPI_TOKEN_5551981155622')
      
      if (request.token === rodrigoBotToken) {
        senderPhone = '5551981155622'
        tokenSecretName = 'WHAPI_TOKEN_5551981155622'
        direction = 'bot_to_seller'
        console.log('🤖 Token identificado como: Rodrigo Bot - Número: 5551981155622')
      } else {
        // Buscar token de vendedor no banco
        const { data: whapiConfig } = await supabase
          .from('whapi_configurations')
          .select('phone_number, token_secret_name, type')
          .eq('active', true)

        if (whapiConfig) {
          for (const config of whapiConfig) {
            const configToken = Deno.env.get(config.token_secret_name)
            if (configToken === request.token) {
              senderPhone = config.phone_number
              tokenSecretName = config.token_secret_name
              direction = config.type === 'seller' ? 'seller_to_customer' : 'bot_to_seller'
              console.log(`👤 Token identificado como: ${config.type} - ${config.phone_number}`)
              break
            }
          }
        }
      }
    }

    console.log('🔍 Identificação do remetente:', {
      senderPhone,
      tokenSecretName,
      direction,
      tokenMatches: senderPhone !== 'unknown'
    })

    if (!request.token || !request.to || !request.content) {
      throw new Error('Token, destinatário e conteúdo são obrigatórios')
    }

    // CRÍTICO: Usar normalização para WHAPI
    let normalizedPhone: string
    try {
      normalizedPhone = normalizePhoneForWhapi(request.to)
      console.log('✅ Número normalizado para WHAPI:', {
        original: request.to,
        normalized: normalizedPhone,
        explanation: 'Formato compatível com WHAPI (sem 9º dígito se celular)'
      })
    } catch (error) {
      console.error('❌ Erro na normalização do número:', error)
      throw new Error(`Erro ao normalizar número: ${error.message}`)
    }

    // Validação adicional
    const phoneValidation = validatePhoneNumber(request.to)
    console.log('📱 Validação do telefone original:', phoneValidation)

    if (!phoneValidation.isValid) {
      throw new Error(`Número de telefone inválido: ${phoneValidation.warnings.join(', ')}`)
    }

    // Determinar endpoint baseado no tipo de mídia
    let endpoint = 'messages/text'
    let payload: any = {
      to: `${normalizedPhone}@s.whatsapp.net`, // USAR NÚMERO NORMALIZADO
      body: request.content
    }

    if (request.type === 'media' && request.media) {
      switch (request.media.type) {
        case 'image':
          endpoint = 'messages/image'
          break
        case 'video':
          endpoint = 'messages/video'
          break
        case 'audio':
          endpoint = 'messages/audio'
          break
        case 'document':
          endpoint = 'messages/document'
          break
        default:
          endpoint = 'messages/image'
      }

      if (request.media.url) {
        payload = {
          to: `${normalizedPhone}@s.whatsapp.net`,
          media: request.media.url,
          caption: request.media.caption || request.content
        }
      } else if (request.media.base64) {
        payload = {
          to: `${normalizedPhone}@s.whatsapp.net`,
          media: request.media.base64,
          filename: request.media.filename,
          caption: request.media.caption || request.content
        }
      }
    }

    if (request.buttons && request.buttons.length > 0) {
      payload.buttons = request.buttons
    }

    const url = `https://gate.whapi.cloud/${endpoint}?token=${request.token}`

    console.log('📤 Enviando para WHAPI (COM NORMALIZAÇÃO):', {
      url: url.replace(request.token, 'TOKEN_HIDDEN'),
      payload: {
        ...payload,
        body: payload.body?.substring(0, 50) + '...'
      },
      normalizacao: {
        original: request.to,
        normalizado: normalizedPhone,
        whatsapp_format: `${normalizedPhone}@s.whatsapp.net`
      },
      sender_identification: {
        senderPhone,
        tokenSecretName,
        direction
      },
      fluxo_esperado: `${senderPhone} → ${normalizedPhone} (NORMALIZADO)`
    })

    // Enviar para WHAPI
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const responseData = await response.json()
    console.log('📨 Resposta WHAPI:', {
      status: response.status,
      success: response.ok,
      data: responseData
    })

    if (!response.ok) {
      console.error('❌ Erro na resposta WHAPI:', {
        status: response.status,
        statusText: response.statusText,
        error: responseData
      })
      throw new Error(`Erro WHAPI ${response.status}: ${responseData.error || responseData.message || 'Erro desconhecido'}`)
    }

    // Preparar dados para log
    const logData = {
      direction: direction,
      phone_from: senderPhone,
      phone_to: normalizedPhone, // USAR NÚMERO NORMALIZADO NOS LOGS
      content: request.content,
      message_type: request.type || 'text',
      media_url: request.media?.url || null,
      whapi_message_id: responseData.message?.id || null,
      token_secret_name: tokenSecretName,
      conversation_id: null,
      seller_id: null,
      status: responseData.sent || response.ok ? 'sent' : 'failed',
      error_message: responseData.sent || response.ok ? null : 'Falha no envio WHAPI',
      metadata: {
        response: responseData,
        original_phone: request.to,
        normalized_phone: normalizedPhone,
        phone_validation: phoneValidation,
        sender_identification: {
          senderPhone,
          tokenSecretName,
          direction,
          tokenMatched: senderPhone !== 'unknown'
        },
        whapi_endpoint: endpoint,
        whapi_status: response.status,
        normalizacao_aplicada: request.to !== normalizedPhone,
        fluxo_corrigido: `${senderPhone} → ${normalizedPhone}`
      }
    }

    console.log('💾 Salvando log (COM NORMALIZAÇÃO):', {
      direction: logData.direction,
      phone_from: logData.phone_from,
      phone_to: logData.phone_to,
      token_secret_name: logData.token_secret_name,
      status: logData.status,
      normalizacao: request.to !== normalizedPhone ? `${request.to} → ${normalizedPhone}` : 'não aplicada'
    })

    // Salvar log no banco
    const { error: logError } = await supabase
      .from('whapi_logs')
      .insert(logData)

    if (logError) {
      console.error('❌ Erro ao salvar log:', logError)
    } else {
      console.log('✅ Log salvo com sucesso - NORMALIZAÇÃO APLICADA')
    }

    // Log de sistema
    await supabase
      .from('system_logs')
      .insert({
        type: responseData.sent || response.ok ? 'success' : 'error',
        source: 'whapi-send',
        message: `Mensagem ${responseData.sent || response.ok ? 'enviada' : 'falhada'} via WHAPI - NORMALIZAÇÃO APLICADA`,
        details: {
          from: senderPhone,
          to: normalizedPhone,
          original_to: request.to,
          direction: direction,
          token_secret_name: tokenSecretName,
          message_id: responseData.message?.id,
          success: responseData.sent || response.ok,
          normalizacao_aplicada: request.to !== normalizedPhone,
          whapi_status: response.status,
          fluxo_corrigido: `${senderPhone} → ${normalizedPhone}`
        }
      })

    return new Response(
      JSON.stringify({
        success: responseData.sent || response.ok || false,
        message_id: responseData.message?.id,
        from: senderPhone,
        to: normalizedPhone,
        original_to: request.to,
        direction: direction,
        token_used: tokenSecretName,
        whapi_response: responseData,
        normalizacao_aplicada: request.to !== normalizedPhone,
        fluxo_corrigido: `${senderPhone} → ${normalizedPhone}`,
        expected_whatsapp_behavior: {
          sender_whatsapp: `Mensagem aparece como ENVIADA (verde) PARA ${normalizedPhone}`,
          recipient_whatsapp: `Mensagem aparece como RECEBIDA (cinza) DE ${senderPhone}`
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro no envio WHAPI:', error)

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
