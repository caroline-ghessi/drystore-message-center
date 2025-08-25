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

    // 1. Diagnóstico do Rodrigo Bot (MODO SEGURO)
    console.log('🤖 Diagnosticando Rodrigo Bot...')
    
    try {
      // Usar função segura para obter token
      const { data: tokenData } = await supabase.functions.invoke('get-whapi-token', {
        body: { 
          tokenSecretName: 'WHAPI_TOKEN_5551981155622',
          requesterType: 'diagnostic'
        }
      })

      if (tokenData?.success && tokenData?.token) {
        // Validar token do Rodrigo Bot via WHAPI
        const { data: rodrigoValidation } = await supabase.functions.invoke('validate-whapi-token', {
          body: { tokenSecretName: 'WHAPI_TOKEN_5551981155622' }
        })

        diagnostics.rodrigo_bot = {
          token_exists: true,
          token_length: tokenData.token.length,
          token_secured: true,
          validation: rodrigoValidation,
          expected_phone: '5551981155622',
          actual_phone: rodrigoValidation?.associatedPhone || 'unknown',
          phone_matches: rodrigoValidation?.associatedPhone === '5551981155622'
        }
      } else {
        diagnostics.rodrigo_bot = {
          token_exists: false,
          error: 'Token não pôde ser acessado via função segura'
        }
      }
    } catch (error) {
      diagnostics.rodrigo_bot = {
        token_exists: false,
        validation_error: error.message,
        security_note: 'Acesso via função segura falhou'
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

        // Verificar se o token existe de forma segura
        try {
          const { data: tokenData } = await supabase.functions.invoke('get-whapi-token', {
            body: { 
              tokenSecretName: config.token_secret_name,
              requesterType: 'diagnostic'
            }
          })
          
          configDiag.token_exists = tokenData?.success || false
          configDiag.token_secured = true

          if (tokenData?.success) {
            try {
              const { data: validation } = await supabase.functions.invoke('validate-whapi-token', {
                body: { tokenSecretName: config.token_secret_name }
              })
              configDiag.token_validation = validation
            } catch (error) {
              configDiag.token_validation = { error: error.message }
            }
          }
        } catch (error) {
          configDiag.token_exists = false
          configDiag.token_validation = { error: 'Falha no acesso seguro ao token' }
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
          whapi_token_secret: seller.whapi_token_secret_name || 'NOT_SET',
          whapi_status: seller.whapi_status,
          auto_first_message: seller.auto_first_message,
          token_validation: null,
          security_compliance: true
        }

        // Se tem token secret name, validar de forma segura
        if (seller.whapi_token_secret_name) {
          try {
            const { data: tokenData } = await supabase.functions.invoke('get-whapi-token', {
              body: { 
                tokenSecretName: seller.whapi_token_secret_name,
                sellerId: seller.id,
                requesterType: 'diagnostic'
              }
            })

            if (tokenData?.success && tokenData?.token) {
              // Validar via endpoint oficial sem expor token
              const { data: validation } = await supabase.functions.invoke('validate-whapi-token', {
                body: { tokenSecretName: seller.whapi_token_secret_name }
              })
              
              sellerDiag.token_validation = {
                valid: validation?.valid || false,
                associated_phone: validation?.associatedPhone || 'unknown',
                token_length: tokenData.token.length
              }
            } else {
              sellerDiag.token_validation = {
                valid: false,
                error: 'Token não acessível via função segura'
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