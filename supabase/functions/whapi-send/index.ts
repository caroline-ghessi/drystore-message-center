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

    // Formatar número de telefone
    const formattedPhone = formatPhoneNumber(request.to)

    // Preparar payload para WHAPI
    const payload: any = {
      to: formattedPhone,
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
      payload: payload
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

    // Log específico WHAPI
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
        request_type: request.type
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

function formatPhoneNumber(phone: string): string {
  // Remove caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '')
  
  // Validação de número brasileiro
  if (cleaned.length < 10 || cleaned.length > 13) {
    throw new Error(`Número de telefone inválido: ${phone}`)
  }
  
  // Se já começa com 55, retorna como está
  if (cleaned.startsWith('55')) {
    return cleaned
  }
  
  // Se começa com 0, remove o 0 e adiciona 55
  if (cleaned.startsWith('0')) {
    return `55${cleaned.substring(1)}`
  }
  
  // Se tem 10 ou 11 dígitos (formato brasileiro sem código do país), adiciona 55
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    return `55${cleaned}`
  }
  
  // Para outros casos, assume que precisa do código do país
  return `55${cleaned}`
}