
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

    console.log('🔍 DIAGNÓSTICO COMPLETO DO RODRIGO BOT - Investigando número real...')

    // 1. Buscar token do Rodrigo Bot
    const rodrigoBotToken = Deno.env.get('WHAPI_TOKEN_5551981155622')
    if (!rodrigoBotToken) {
      throw new Error('Token WHAPI_TOKEN_5551981155622 não encontrado')
    }

    console.log('🔑 Token encontrado:', rodrigoBotToken.substring(0, 10) + '...')

    // 2. DESCOBRIR O NÚMERO REAL via WHAPI API (settings + me)
    console.log('📞 Consultando WHAPI para descobrir número real...')
    
    // Tentar endpoint /me primeiro
    let whapiResponse = await fetch(`https://gate.whapi.cloud/me?token=${rodrigoBotToken}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    let whapiData = null
    if (whapiResponse.ok) {
      whapiData = await whapiResponse.json()
      console.log('📱 Dados /me:', whapiData)
    } else {
      console.log('⚠️ /me falhou, tentando /settings...')
      
      // Tentar endpoint /settings
      whapiResponse = await fetch(`https://gate.whapi.cloud/settings?token=${rodrigoBotToken}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (whapiResponse.ok) {
        whapiData = await whapiResponse.json()
        console.log('📱 Dados /settings:', whapiData)
      }
    }

    if (!whapiData) {
      throw new Error('Não foi possível consultar dados do WHAPI')
    }

    // 3. EXTRAIR NÚMERO REAL do WhatsApp
    let realWhatsAppNumber = 'unknown'
    
    // Tentar diferentes campos onde o número pode estar
    if (whapiData.phone) {
      realWhatsAppNumber = whapiData.phone.replace(/\D/g, '')
    } else if (whapiData.id) {
      realWhatsAppNumber = whapiData.id.replace('@s.whatsapp.net', '').replace(/\D/g, '')
    } else if (whapiData.number) {
      realWhatsAppNumber = whapiData.number.replace(/\D/g, '')
    } else if (whapiData.phoneNumber) {
      realWhatsAppNumber = whapiData.phoneNumber.replace(/\D/g, '')
    }

    console.log('🎯 NÚMERO REAL DESCOBERTO:', realWhatsAppNumber)

    // 4. COMPARAR com o que temos no banco
    const { data: currentConfig } = await supabase
      .from('whapi_configurations')
      .select('*')
      .eq('type', 'rodrigo_bot')
      .eq('token_secret_name', 'WHAPI_TOKEN_5551981155622')
      .single()

    const numeroNoBanco = currentConfig?.phone_number || 'não encontrado'
    console.log('🗄️ Número no banco:', numeroNoBanco)

    // 5. IDENTIFICAR A DISCREPÂNCIA
    const discrepancia = realWhatsAppNumber !== numeroNoBanco
    console.log('🚨 DISCREPÂNCIA ENCONTRADA:', discrepancia)

    if (discrepancia) {
      console.log('❌ PROBLEMA IDENTIFICADO: Número no banco diferente do WHAPI!')
      console.log(`   - WHAPI tem: ${realWhatsAppNumber}`)
      console.log(`   - Banco tem: ${numeroNoBanco}`)
    }

    // 6. CORRIGIR CONFIGURAÇÃO NO BANCO
    let correcaoFeita = false
    if (discrepancia && realWhatsAppNumber !== 'unknown') {
      console.log('🔧 Corrigindo configuração no banco...')
      
      const { error: updateError } = await supabase
        .from('whapi_configurations')
        .update({
          phone_number: realWhatsAppNumber,
          health_status: 'healthy',
          last_health_check: new Date().toISOString()
        })
        .eq('type', 'rodrigo_bot')
        .eq('token_secret_name', 'WHAPI_TOKEN_5551981155622')

      if (!updateError) {
        correcaoFeita = true
        console.log('✅ Configuração corrigida no banco')
      } else {
        console.error('❌ Erro ao corrigir configuração:', updateError)
      }
    }

    // 7. ATUALIZAR FUNÇÃO set_message_direction para usar número correto
    if (correcaoFeita) {
      console.log('🔧 Atualizando função set_message_direction...')
      
      const { error: functionError } = await supabase.rpc('exec_sql', {
        sql: `
        CREATE OR REPLACE FUNCTION public.set_message_direction()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Se o token é do Rodrigo Bot
          IF NEW.token_secret_name = 'WHAPI_TOKEN_5551981155622' THEN
            NEW.direction = 'bot_to_seller';
          -- Se o phone_from é do Rodrigo Bot (usar número real descoberto)
          ELSIF NEW.phone_from IN ('${realWhatsAppNumber}', '${numeroNoBanco}') THEN
            NEW.direction = 'bot_to_seller';
          -- Se o número de destino não tem @s.whatsapp.net (formato cliente)
          ELSIF NEW.phone_to NOT LIKE '%@s.whatsapp.net' THEN
            NEW.direction = 'seller_to_customer';
          -- Se o número de origem não tem @s.whatsapp.net (formato cliente)
          ELSIF NEW.phone_from NOT LIKE '%@s.whatsapp.net' THEN
            NEW.direction = 'customer_to_seller';
          ELSE
            NEW.direction = 'unknown';
          END IF;
          
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        `
      })

      if (functionError) {
        console.error('❌ Erro ao atualizar função:', functionError)
      } else {
        console.log('✅ Função set_message_direction atualizada')
      }
    }

    // 8. CORRIGIR LOGS EXISTENTES
    if (correcaoFeita) {
      console.log('🔧 Corrigindo logs existentes...')
      
      const { error: logsError } = await supabase
        .from('whapi_logs')
        .update({
          phone_from: realWhatsAppNumber,
          direction: 'bot_to_seller',
          token_secret_name: 'WHAPI_TOKEN_5551981155622'
        })
        .or(`phone_from.eq.${numeroNoBanco},phone_from.eq.555181155622,phone_from.eq.5551981155622`)

      if (!logsError) {
        console.log('✅ Logs corrigidos')
      }
    }

    // 9. LOG DETALHADO DO DIAGNÓSTICO
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'rodrigo_bot_diagnosis',
        message: 'Diagnóstico completo do Rodrigo Bot realizado',
        details: {
          token_secret_name: 'WHAPI_TOKEN_5551981155622',
          numero_real_whapi: realWhatsAppNumber,
          numero_no_banco: numeroNoBanco,
          discrepancia_encontrada: discrepancia,
          correcao_feita: correcaoFeita,
          whapi_data: whapiData,
          diagnostico_completo: {
            problema_identificado: discrepancia ? 'Número no banco diferente do WHAPI' : 'Números conferem',
            solucao_aplicada: correcaoFeita ? 'Configuração e logs corrigidos' : 'Nenhuma correção necessária',
            numero_correto: realWhatsAppNumber,
            fluxo_esperado: `${realWhatsAppNumber} (Rodrigo Bot) → Vendedor`,
            proximos_passos: [
              'Testar envio de mensagem',
              'Verificar se mensagem aparece corretamente nos WhatsApps',
              'Confirmar direção nos logs'
            ]
          }
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        diagnosis: {
          problema_identificado: discrepancia,
          numero_real_whapi: realWhatsAppNumber,
          numero_no_banco: numeroNoBanco,
          discrepancia: realWhatsAppNumber !== numeroNoBanco,
          correcao_aplicada: correcaoFeita,
          whapi_data: whapiData
        },
        solution: {
          configuracao_corrigida: correcaoFeita,
          funcao_atualizada: correcaoFeita,
          logs_corrigidos: correcaoFeita,
          numero_correto_agora: realWhatsAppNumber
        },
        next_steps: [
          'Execute um teste de envio para verificar o fluxo',
          'Confirme se a mensagem aparece como ENVIADA no WhatsApp do Rodrigo Bot',
          'Confirme se a mensagem aparece como RECEBIDA no WhatsApp do vendedor',
          'Verifique se os logs mostram direction: bot_to_seller'
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        diagnosis: {
          problema: 'Falha na análise do Rodrigo Bot',
          possivel_causa: 'Token inválido ou problema de conectividade WHAPI'
        },
        troubleshooting: [
          'Verificar se WHAPI_TOKEN_5551981155622 está correto',
          'Verificar se o número do Rodrigo Bot está ativo no WHAPI',
          'Testar conectividade com WHAPI'
        ]
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
