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

    console.log('🔍 Iniciando diagnóstico completo do sistema WHAPI...')

    const diagnostics = {
      timestamp: new Date().toISOString(),
      rodrigo_bot: {},
      sellers: [],
      configurations: [],
      recent_logs: [],
      token_validations: [],
      system_health: 'unknown'
    }

    // 1. Diagnóstico do Rodrigo Bot
    console.log('🤖 Diagnosticando Rodrigo Bot...')
    const rodrigoBotToken = Deno.env.get('WHAPI_TOKEN_5551981155622')
    
    if (rodrigoBotToken) {
      try {
        // Validar token do Rodrigo Bot via WHAPI
        const { data: rodrigoValidation } = await supabase.functions.invoke('validate-whapi-token', {
          body: { tokenSecretName: 'WHAPI_TOKEN_5551981155622' }
        })

        diagnostics.rodrigo_bot = {
          token_exists: true,
          token_length: rodrigoBotToken.length,
          token_masked: rodrigoBotToken.substring(0, 10) + '...',
          validation: rodrigoValidation,
          expected_phone: '5551981155622',
          actual_phone: rodrigoValidation?.associatedPhone || 'unknown',
          phone_matches: rodrigoValidation?.associatedPhone === '5551981155622'
        }
      } catch (error) {
        diagnostics.rodrigo_bot = {
          token_exists: true,
          validation_error: error.message,
          token_masked: rodrigoBotToken.substring(0, 10) + '...'
        }
      }
    } else {
      diagnostics.rodrigo_bot = {
        token_exists: false,
        error: 'Token WHAPI_TOKEN_5551981155622 não encontrado'
      }
    }

    // 2. Diagnóstico das configurações WHAPI
    console.log('⚙️ Diagnosticando configurações WHAPI...')
    const { data: configs } = await supabase
      .from('whapi_configurations')
      .select('*')
      .order('created_at', { ascending: false })

    if (configs) {
      for (const config of configs) {
        const configDiag = {
          id: config.id,
          name: config.name,
          type: config.type,
          phone_number: config.phone_number,
          token_secret_name: config.token_secret_name,
          active: config.active,
          health_status: config.health_status,
          token_exists: false,
          token_validation: null
        }

        // Verificar se o token existe
        const token = Deno.env.get(config.token_secret_name)
        configDiag.token_exists = !!token

        if (token) {
          try {
            const { data: validation } = await supabase.functions.invoke('validate-whapi-token', {
              body: { tokenSecretName: config.token_secret_name }
            })
            configDiag.token_validation = validation
          } catch (error) {
            configDiag.token_validation = { error: error.message }
          }
        }

        diagnostics.configurations.push(configDiag)
      }
    }

    // 3. Diagnóstico dos vendedores
    console.log('👥 Diagnosticando vendedores...')
    const { data: sellers } = await supabase
      .from('sellers')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (sellers) {
      for (const seller of sellers) {
        const sellerDiag = {
          id: seller.id,
          name: seller.name,
          phone_number: seller.phone_number,
          whapi_token: seller.whapi_token ? 'SET' : 'NOT_SET',
          whapi_status: seller.whapi_status,
          auto_first_message: seller.auto_first_message,
          token_validation: null
        }

        // Se tem token próprio, validar
        if (seller.whapi_token) {
          try {
            const response = await fetch(`https://gate.whapi.cloud/me?token=${seller.whapi_token}`, {
              method: 'GET'
            })
            if (response.ok) {
              const data = await response.json()
              sellerDiag.token_validation = {
                valid: true,
                associated_phone: data.phone?.replace(/\D/g, '') || 'unknown'
              }
            } else {
              sellerDiag.token_validation = {
                valid: false,
                error: `HTTP ${response.status}`
              }
            }
          } catch (error) {
            sellerDiag.token_validation = {
              valid: false,
              error: error.message
            }
          }
        }

        diagnostics.sellers.push(sellerDiag)
      }
    }

    // 4. Logs recentes
    console.log('📊 Analisando logs recentes...')
    const { data: recentLogs } = await supabase
      .from('whapi_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    diagnostics.recent_logs = recentLogs || []

    // 5. Determinar saúde do sistema
    let systemHealth = 'healthy'
    const issues = []

    if (!diagnostics.rodrigo_bot.token_exists) {
      issues.push('Token do Rodrigo Bot não encontrado')
      systemHealth = 'critical'
    } else if (!diagnostics.rodrigo_bot.phone_matches) {
      issues.push('Número do Rodrigo Bot não confere')
      systemHealth = 'warning'
    }

    if (diagnostics.configurations.length === 0) {
      issues.push('Nenhuma configuração WHAPI encontrada')
      systemHealth = 'warning'
    }

    const activeConfigs = diagnostics.configurations.filter(c => c.active)
    if (activeConfigs.length === 0) {
      issues.push('Nenhuma configuração WHAPI ativa')
      systemHealth = 'critical'
    }

    diagnostics.system_health = systemHealth
    diagnostics.issues = issues

    console.log('✅ Diagnóstico completo:', {
      health: systemHealth,
      issues: issues.length,
      configs: diagnostics.configurations.length,
      sellers: diagnostics.sellers.length
    })

    return new Response(
      JSON.stringify({
        success: true,
        diagnostics,
        summary: {
          system_health: systemHealth,
          total_issues: issues.length,
          issues: issues,
          rodrigo_bot_ok: diagnostics.rodrigo_bot.token_exists && diagnostics.rodrigo_bot.phone_matches,
          active_configs: activeConfigs.length,
          active_sellers: diagnostics.sellers.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error)

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