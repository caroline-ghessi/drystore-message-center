
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('🔍 Verificando número real do Rodrigo Bot...')

    // 1. Buscar token do Rodrigo Bot
    const rodrigoBotToken = Deno.env.get('WHAPI_TOKEN_5551981155622')
    if (!rodrigoBotToken) {
      throw new Error('Token do Rodrigo Bot não encontrado')
    }

    console.log('🤖 Token encontrado, consultando WHAPI...')

    // 2. Consultar WHAPI para descobrir o número real
    const response = await fetch(`https://gate.whapi.cloud/me?token=${rodrigoBotToken}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Erro ao consultar WHAPI: ${response.status} - ${errorData.error || 'Erro desconhecido'}`)
    }

    const whapiData = await response.json()
    console.log('📱 Dados do WHAPI:', whapiData)

    // 3. Extrair número real do WhatsApp
    let realPhoneNumber = 'unknown'
    if (whapiData.phone) {
      realPhoneNumber = whapiData.phone.replace(/\D/g, '') // Remove caracteres não numéricos
    } else if (whapiData.id) {
      realPhoneNumber = whapiData.id.replace('@s.whatsapp.net', '').replace(/\D/g, '')
    }

    console.log('📞 Número real extraído:', realPhoneNumber)

    // 4. Número fornecido pelo usuário (formatado)
    const userProvidedNumber = '5551981155622' // 51 981155622 com código do país

    console.log('🔄 Comparando números:', {
      numeroReal: realPhoneNumber,
      numeroUsuario: userProvidedNumber,
      conferem: realPhoneNumber === userProvidedNumber
    })

    // 5. Atualizar configuração do Rodrigo Bot no banco
    const { error: updateError } = await supabase
      .from('whapi_configurations')
      .update({
        phone_number: realPhoneNumber,
        health_status: 'healthy',
        last_health_check: new Date().toISOString()
      })
      .eq('type', 'rodrigo_bot')
      .eq('token_secret_name', 'WHAPI_TOKEN_5551981155622')

    if (updateError) {
      console.error('❌ Erro ao atualizar configuração:', updateError)
    } else {
      console.log('✅ Configuração do Rodrigo Bot atualizada')
    }

    // 6. Atualizar logs existentes com o número correto
    const { error: logsError } = await supabase
      .from('whapi_logs')
      .update({
        phone_from: realPhoneNumber,
        token_secret_name: 'WHAPI_TOKEN_5551981155622',
        direction: 'bot_to_seller'
      })
      .or(`phone_from.eq.${userProvidedNumber},phone_from.eq.555181155622,phone_from.eq.5551981155622`)

    if (logsError) {
      console.error('❌ Erro ao atualizar logs:', logsError)
    } else {
      console.log('✅ Logs atualizados')
    }

    // 7. Log do sistema
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'rodrigo_bot_fix',
        message: 'Número do Rodrigo Bot corrigido',
        details: {
          numero_real_whapi: realPhoneNumber,
          numero_usuario: userProvidedNumber,
          numeros_conferem: realPhoneNumber === userProvidedNumber,
          whapi_data: whapiData,
          configuracao_atualizada: !updateError,
          logs_atualizados: !logsError
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Número do Rodrigo Bot verificado e corrigido',
        details: {
          numero_real_whapi: realPhoneNumber,
          numero_usuario_fornecido: userProvidedNumber,
          numeros_conferem: realPhoneNumber === userProvidedNumber,
          whapi_status: whapiData.status,
          whapi_name: whapiData.name,
          configuracao_atualizada: !updateError,
          logs_atualizados: !logsError,
          proximos_passos: [
            'Testar envio de mensagem',
            'Verificar direção nos logs',
            'Confirmar recebimento pelo vendedor'
          ]
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro na correção:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        troubleshooting: {
          verificar_token: 'Token WHAPI_TOKEN_5551981155622 está correto?',
          verificar_whapi: 'Número 51981155622 está ativo no WHAPI?',
          verificar_formato: 'Formato do número está correto?'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
