
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
    
    // Mascarar token para logs
    const tokenMasked = request.token.substring(0, 10) + '...'
    
    console.log('📨 WHAPI Send request recebido:', {
      token: tokenMasked,
      to: request.to,
      content: request.content.substring(0, 50) + '...',
      type: request.type || 'text'
    })

    // CRÍTICO: Identificar qual número está enviando baseado no token
    let senderPhone = 'unknown'
    let tokenSecretName = 'unknown'
    let direction = 'unknown'

    // Verificar se é o token do Rodrigo Bot
    if (request.token.length > 20) { // Validação básica de token WHAPI
      const rodrigoBotToken = Deno.env.get('WHAPI_TOKEN_5551981155622')
      
      if (request.token === rodrigoBotToken) {
        // CORREÇÃO: Usar o número correto do usuário
        senderPhone = '5551981155622' // 51 981155622 com código 55
        tokenSecretName = 'WHAPI_TOKEN_5551981155622'
        direction = 'bot_to_seller'
        console.log('🤖 Token identificado como: Rodrigo Bot - Número correto: 5551981155622')
      } else {
        // Pode ser token de vendedor - buscar no banco
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

    console.log('🔍 Identificação do remetente CORRIGIDA:', {
      senderPhone,
      tokenSecretName,
      direction,
      tokenMatches: senderPhone !== 'unknown',
      fluxo_esperado: senderPhone === '5551981155622' ? 'Rodrigo Bot → Vendedor' : 'Outro fluxo'
    })

    // Validar campos obrigatórios
    if (!request.token || !request.to || !request.content) {
      throw new Error('Token, destinatário e conteúdo são obrigatórios')
    }

    // Validação e formatação do número de telefone
    const phoneValidation = validatePhoneNumber(request.to)
    console.log('📱 Validação do telefone:', phoneValidation)

    if (!phoneValidation.isValid) {
      throw new Error(`Número de telefone inválido: ${phoneValidation.warnings.join(', ')}`)
    }

    // Se tem warnings críticos, alertar mas continuar
    if (phoneValidation.warnings.length > 0) {
      console.warn('⚠️ Avisos na validação do telefone:', phoneValidation.warnings)
      
      // Se número não começa com 9 (celular), pode ser problema
      const numberPart = phoneValidation.formatted.substring(4) // Remove 55XX
      if (!numberPart.startsWith('9') && numberPart.length === 9) {
        throw new Error('Número parece ser fixo, não celular. WhatsApp requer números de celular.')
      }
    }

    // Determinar endpoint baseado no tipo de mídia
    let endpoint = 'messages/text'
    let payload: any = {
      to: `${phoneValidation.formatted}@s.whatsapp.net`,
      body: request.content
    }

    if (request.type === 'media' && request.media) {
      // Endpoint dinâmico baseado no tipo de mídia
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
          endpoint = 'messages/image' // fallback para compatibilidade
      }

      if (request.media.url) {
        payload = {
          to: `${phoneValidation.formatted}@s.whatsapp.net`,
          media: request.media.url,
          caption: request.media.caption || request.content
        }
      } else if (request.media.base64) {
        payload = {
          to: `${phoneValidation.formatted}@s.whatsapp.net`,
          media: request.media.base64,
          filename: request.media.filename,
          caption: request.media.caption || request.content
        }
      }
    }

    // Adicionar botões se fornecidos
    if (request.buttons && request.buttons.length > 0) {
      payload.buttons = request.buttons
    }

    // URL da API WHAPI com autenticação padronizada
    const url = `https://gate.whapi.cloud/${endpoint}?token=${request.token}`

    console.log('📤 Enviando para WHAPI (FLUXO CORRIGIDO):', {
      url: url.replace(request.token, 'TOKEN_HIDDEN'),
      payload: {
        ...payload,
        body: payload.body?.substring(0, 50) + '...'
      },
      phone_validation: phoneValidation,
      sender_identification: {
        senderPhone,
        tokenSecretName,
        direction
      },
      fluxo_esperado: `${senderPhone} → ${phoneValidation.formatted}`,
      direcao_esperada: direction
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

    // Preparar dados para log com informações CORRETAS
    const logData = {
      direction: direction, // USAR A DIREÇÃO IDENTIFICADA CORRETAMENTE
      phone_from: senderPhone, // RODRIGO BOT: 5551981155622
      phone_to: phoneValidation.formatted, // VENDEDOR: ex. 5551997519607
      content: request.content,
      message_type: request.type || 'text',
      media_url: request.media?.url || null,
      whapi_message_id: responseData.message?.id || null,
      token_secret_name: tokenSecretName, // WHAPI_TOKEN_5551981155622
      conversation_id: null,
      seller_id: null,
      status: responseData.sent || response.ok ? 'sent' : 'failed',
      error_message: responseData.sent || response.ok ? null : 'Falha no envio WHAPI',
      metadata: {
        response: responseData,
        original_phone: request.to,
        phone_validation: phoneValidation,
        sender_identification: {
          senderPhone,
          tokenSecretName,
          direction,
          tokenMatched: senderPhone !== 'unknown'
        },
        whapi_endpoint: endpoint,
        whapi_status: response.status,
        fluxo_corrigido: `${senderPhone} → ${phoneValidation.formatted}`,
        expected_whatsapp_behavior: {
          rodrigo_bot_whatsapp: `Mensagem aparece como ENVIADA (verde) PARA ${phoneValidation.formatted}`,
          seller_whatsapp: `Mensagem aparece como RECEBIDA (cinza) DE ${senderPhone}`
        }
      }
    }

    console.log('💾 Salvando log com dados CORRIGIDOS:', {
      direction: logData.direction,
      phone_from: logData.phone_from,
      phone_to: logData.phone_to,
      token_secret_name: logData.token_secret_name,
      status: logData.status,
      fluxo: `${logData.phone_from} → ${logData.phone_to}`
    })

    // Salvar log no banco
    const { error: logError } = await supabase
      .from('whapi_logs')
      .insert(logData)

    if (logError) {
      console.error('❌ Erro ao salvar log:', logError)
    } else {
      console.log('✅ Log salvo com sucesso - FLUXO CORRIGIDO')
    }

    // Log de sistema para operações importantes
    await supabase
      .from('system_logs')
      .insert({
        type: responseData.sent || response.ok ? 'success' : 'error',
        source: 'whapi-send',
        message: `Mensagem ${responseData.sent || response.ok ? 'enviada' : 'falhada'} via WHAPI - FLUXO CORRIGIDO`,
        details: {
          from: senderPhone,
          to: phoneValidation.formatted,
          direction: direction,
          token_secret_name: tokenSecretName,
          message_id: responseData.message?.id,
          success: responseData.sent || response.ok,
          warnings: phoneValidation.warnings,
          whapi_status: response.status,
          fluxo_corrigido: `${senderPhone} → ${phoneValidation.formatted}`,
          expected_result: {
            rodrigo_bot_sees: "Mensagem ENVIADA (verde) no WhatsApp",
            seller_sees: "Mensagem RECEBIDA (cinza) no WhatsApp"
          }
        }
      })

    return new Response(
      JSON.stringify({
        success: responseData.sent || response.ok || false,
        message_id: responseData.message?.id,
        from: senderPhone,
        to: phoneValidation.formatted,
        direction: direction,
        token_used: tokenSecretName,
        whapi_response: responseData,
        fluxo_corrigido: `${senderPhone} → ${phoneValidation.formatted}`,
        expected_whatsapp_behavior: {
          rodrigo_bot_whatsapp: `Mensagem aparece como ENVIADA (verde) PARA ${phoneValidation.formatted}`,
          seller_whatsapp: `Mensagem aparece como RECEBIDA (cinza) DE ${senderPhone}`
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

function validatePhoneNumber(phone: string): { isValid: boolean; formatted: string; warnings: string[] } {
  const warnings: string[] = []
  let cleaned = phone.replace(/\D/g, '')

  if (!cleaned) {
    return { isValid: false, formatted: '', warnings: ['Número vazio'] }
  }

  // Remover zeros à esquerda
  cleaned = cleaned.replace(/^0+/, '')

  // Verificar se já tem código do país
  if (!cleaned.startsWith('55')) {
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      cleaned = '55' + cleaned
      warnings.push('Código do país (55) adicionado automaticamente')
    } else {
      warnings.push('Número com formato suspeito')
    }
  }

  // Validar comprimento final (55 + DDD + número)
  if (cleaned.length < 12 || cleaned.length > 13) {
    warnings.push(`Comprimento inválido: ${cleaned.length} dígitos`)
    return { isValid: false, formatted: cleaned, warnings }
  }

  // Verificar se é número brasileiro válido
  if (!cleaned.startsWith('55')) {
    warnings.push('Não é um número brasileiro')
    return { isValid: false, formatted: cleaned, warnings }
  }

  // Verificar DDD válido (11-99)
  const ddd = cleaned.substring(2, 4)
  if (parseInt(ddd) < 11 || parseInt(ddd) > 99) {
    warnings.push(`DDD inválido: ${ddd}`)
    return { isValid: false, formatted: cleaned, warnings }
  }

  // Verificar se é número de celular (deve começar com 9)
  const numberPart = cleaned.substring(4)
  if (numberPart.length === 9 && !numberPart.startsWith('9')) {
    warnings.push('Número pode ser fixo - WhatsApp funciona apenas com celulares')
  }

  return { isValid: true, formatted: cleaned, warnings }
}
