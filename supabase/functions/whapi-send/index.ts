import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WhapiSendRequest {
  token: string;
  to: string;
  type: 'text' | 'media';
  content: string;
  media?: {
    url?: string;
    base64?: string;
    filename?: string;
    caption?: string;
  };
  buttons?: Array<{
    id: string;
    text: string;
  }>;
  quoted?: string;
}

interface WhapiResponse {
  sent: boolean;
  message: {
    id: string;
    from: string;
    to: string;
    body: string;
    timestamp: number;
    status: string;
  };
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

    const request: WhapiSendRequest = await req.json()
    console.log('WHAPI Send request:', request)

    // Validar dados obrigatórios
    if (!request.token || !request.to || !request.content) {
      throw new Error('Token, telefone de destino e conteúdo são obrigatórios')
    }

    // Formatar e validar número de telefone
    const phoneValidation = formatAndValidatePhoneNumber(request.to)
    if (!phoneValidation.isValid) {
      throw new Error(`Número de telefone inválido: ${phoneValidation.error}`)
    }

    const formattedPhone = phoneValidation.formatted

    // Log da validação se houve warnings
    if (phoneValidation.warnings.length > 0) {
      await supabase.from('system_logs').insert({
        type: 'warning',
        source: 'whapi-send',
        message: 'Avisos na validação do número',
        details: {
          original: request.to,
          formatted: formattedPhone,
          warnings: phoneValidation.warnings
        }
      })
    }

    // Preparar payload para WHAPI usando formato Chat ID correto
    const payload: any = {
      to: `${formattedPhone}@s.whatsapp.net`,
      body: request.content
    }

    // Adicionar mídia se fornecida
    if (request.media) {
      if (request.media.url) {
        payload.media = {
          url: request.media.url,
          caption: request.media.caption || request.content
        }
      } else if (request.media.base64) {
        payload.media = {
          base64: request.media.base64,
          filename: request.media.filename || 'file',
          caption: request.media.caption || request.content
        }
      }
    }

    // Adicionar botões se fornecidos
    if (request.buttons && request.buttons.length > 0) {
      payload.buttons = request.buttons
    }

    // Adicionar citação se fornecida
    if (request.quoted) {
      payload.quoted = request.quoted
    }

    // Determinar endpoint baseado no tipo
    const endpoint = request.type === 'media' && request.media 
      ? 'messages/image' 
      : 'messages/text'

    // Enviar via WHAPI
    const whapiUrl = `https://gate.whapi.cloud/${endpoint}?token=${request.token}`
    
    console.log('Enviando para WHAPI:', {
      url: whapiUrl,
      payload: payload,
      phone_validation: phoneValidation
    })

    const response = await fetch(whapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('Erro WHAPI:', responseData)
      throw new Error(`WHAPI error: ${responseData.message || response.statusText}`)
    }

    console.log('Resposta WHAPI:', responseData)

    // Log da chamada
    await supabase.from('webhook_logs').insert({
      method: 'POST',
      url: whapiUrl,
      source: 'whapi-send',
      body: payload,
      response_status: response.status,
      response_body: responseData
    })

    // Log específico WHAPI com validação
    await supabase.from('whapi_logs').insert({
      direction: 'sent',
      phone_from: responseData.message?.from || 'unknown',
      phone_to: formattedPhone,
      content: request.content,
      message_type: request.type,
      media_url: request.media?.url,
      whapi_message_id: responseData.message?.id,
      token_used: request.token.substring(0, 10) + '...',
      status: 'sent',
      metadata: {
        response: responseData,
        request_type: request.type,
        phone_validation: phoneValidation,
        original_phone: request.to
      }
    })

    // Log de sistema
    await supabase.from('system_logs').insert({
      type: 'success',
      source: 'whapi-send',
      message: `Mensagem WHAPI enviada para ${formattedPhone}`,
      details: {
        to: formattedPhone,
        type: request.type,
        message_id: responseData.message?.id
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        message_id: responseData.message?.id,
        to: formattedPhone,
        phone_validation: phoneValidation,
        data: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro no envio WHAPI:', error)

    // Log do erro
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'whapi-send',
      message: 'Erro ao enviar mensagem WHAPI',
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

function formatAndValidatePhoneNumber(phone: string): {
  isValid: boolean;
  formatted: string;
  error?: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Remove caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  if (!cleaned) {
    return { isValid: false, formatted: '', error: 'Número vazio', warnings };
  }

  // Remove zeros à esquerda
  cleaned = cleaned.replace(/^0+/, '');
  
  // Verificar comprimento mínimo
  if (cleaned.length < 10) {
    return { 
      isValid: false, 
      formatted: cleaned, 
      error: `Número muito curto: ${cleaned.length} dígitos`, 
      warnings 
    };
  }

  // Se não começa com 55, adicionar código do país
  if (!cleaned.startsWith('55')) {
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
      warnings.push('Código do país (55) adicionado automaticamente');
    } else {
      return { 
        isValid: false, 
        formatted: cleaned, 
        error: `Comprimento inválido sem código do país: ${cleaned.length}`, 
        warnings 
      };
    }
  }

  // Validar comprimento final (12-13 dígitos)
  if (cleaned.length < 12 || cleaned.length > 13) {
    return { 
      isValid: false, 
      formatted: cleaned, 
      error: `Comprimento final inválido: ${cleaned.length} dígitos`, 
      warnings 
    };
  }

  // Extrair e validar DDD (deve estar entre 11 e 99)
  const ddd = cleaned.substring(2, 4);
  const dddNum = parseInt(ddd);
  if (dddNum < 11 || dddNum > 99) {
    return { 
      isValid: false, 
      formatted: cleaned, 
      error: `DDD inválido: ${ddd}`, 
      warnings 
    };
  }

  // Validar número do telefone (deve ter 8 ou 9 dígitos após DDD)
  const phoneNumber = cleaned.substring(4);
  if (phoneNumber.length < 8 || phoneNumber.length > 9) {
    return { 
      isValid: false, 
      formatted: cleaned, 
      error: `Número de telefone inválido: ${phoneNumber} (${phoneNumber.length} dígitos)`, 
      warnings 
    };
  }

  // Verificar se é celular (9 dígitos começando com 9)
  if (phoneNumber.length === 9 && !phoneNumber.startsWith('9')) {
    warnings.push('Número de 9 dígitos que não começa com 9 - pode ser inválido');
  }

  // Verificar se é fixo (8 dígitos não começando com 9)
  if (phoneNumber.length === 8 && phoneNumber.startsWith('9')) {
    warnings.push('Número de 8 dígitos começando com 9 - formato suspeito');
  }

  return {
    isValid: true,
    formatted: cleaned,
    warnings
  };
}
