
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
    console.log('WHAPI Send request:', {
      token: request.token.substring(0, 10) + '...',
      to: request.to,
      content: request.content
    })

    // Validar campos obrigatórios
    if (!request.token || !request.to || !request.content) {
      throw new Error('Token, destinatário e conteúdo são obrigatórios')
    }

    // Validação e formatação do número de telefone
    const phoneValidation = validatePhoneNumber(request.to)
    console.log('Validação do telefone:', phoneValidation)

    if (!phoneValidation.isValid) {
      throw new Error(`Número de telefone inválido: ${phoneValidation.warnings.join(', ')}`)
    }

    // Se tem warnings críticos, alertar mas continuar
    if (phoneValidation.warnings.length > 0) {
      console.warn('Avisos na validação do telefone:', phoneValidation.warnings)
      
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

    console.log('Enviando para WHAPI:', {
      url: url.replace(request.token, 'TOKEN_HIDDEN'),
      payload,
      phone_validation: phoneValidation
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
    console.log('Resposta WHAPI:', responseData)

    if (!response.ok) {
      throw new Error(`Erro WHAPI ${response.status}: ${responseData.error || responseData.message || 'Erro desconhecido'}`)
    }

    // Preparar dados para log
    const logData = {
      direction: 'sent',
      phone_from: responseData.message?.from || 'sistema',
      phone_to: phoneValidation.formatted,
      content: request.content,
      message_type: request.type || 'text',
      media_url: request.media?.url || null,
      whapi_message_id: responseData.message?.id || null,
      token_used: request.token.substring(0, 10) + '...',
      conversation_id: null,
      seller_id: null,
      status: responseData.sent ? 'sent' : 'failed',
      error_message: responseData.sent ? null : 'Falha no envio WHAPI',
      metadata: {
        response: responseData,
        original_phone: request.to,
        phone_validation: phoneValidation
      }
    }

    // Salvar log no banco
    const { error: logError } = await supabase
      .from('whapi_logs')
      .insert(logData)

    if (logError) {
      console.error('Erro ao salvar log:', logError)
    }

    // Log de sistema para operações importantes
    await supabase
      .from('system_logs')
      .insert({
        type: responseData.sent ? 'success' : 'error',
        source: 'whapi-send',
        message: `Mensagem ${responseData.sent ? 'enviada' : 'falhada'} via WHAPI`,
        details: {
          to: phoneValidation.formatted,
          message_id: responseData.message?.id,
          success: responseData.sent,
          warnings: phoneValidation.warnings
        }
      })

    return new Response(
      JSON.stringify({
        success: responseData.sent || false,
        message_id: responseData.message?.id,
        to: phoneValidation.formatted,
        whapi_response: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro no envio WHAPI:', error)

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
