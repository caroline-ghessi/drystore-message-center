import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidateTokenRequest {
  tokenSecretName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tokenSecretName }: ValidateTokenRequest = await req.json()
    console.log('🔍 Validando token:', tokenSecretName)

    if (!tokenSecretName) {
      throw new Error('Nome do secret é obrigatório')
    }

    // Buscar token do ambiente
    const token = Deno.env.get(tokenSecretName)
    if (!token) {
      throw new Error(`Token '${tokenSecretName}' não encontrado`)
    }

    console.log('✅ Token encontrado, validando com WHAPI...')

    // Validar token com WHAPI - verificar qual número está associado
    const response = await fetch(`https://gate.whapi.cloud/me?token=${token}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Token inválido no WHAPI: ${response.status} - ${errorData.error || 'Erro desconhecido'}`)
    }

    const whapiData = await response.json()
    console.log('📱 Dados do WHAPI:', whapiData)

    // Extrair número do WhatsApp (pode vir em formatos diferentes)
    let phoneNumber = 'unknown'
    if (whapiData.phone) {
      phoneNumber = whapiData.phone.replace(/\D/g, '') // Remove caracteres não numéricos
    } else if (whapiData.id) {
      phoneNumber = whapiData.id.replace('@s.whatsapp.net', '').replace(/\D/g, '')
    }

    console.log('✅ Validação bem-sucedida:', {
      tokenSecretName,
      associatedPhone: phoneNumber,
      whapiStatus: whapiData.status || 'unknown',
      whapiName: whapiData.name || 'N/A'
    })

    return new Response(
      JSON.stringify({
        success: true,
        tokenSecretName,
        associatedPhone: phoneNumber,
        whapiData: {
          phone: phoneNumber,
          status: whapiData.status,
          name: whapiData.name,
          id: whapiData.id
        },
        validation: {
          tokenExists: true,
          tokenValid: true,
          phoneExtracted: phoneNumber !== 'unknown'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro na validação:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        validation: {
          tokenExists: false,
          tokenValid: false,
          phoneExtracted: false
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})