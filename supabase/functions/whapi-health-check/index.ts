
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('🏥 Iniciando verificação de saúde do WHAPI...')

    // Buscar todas as configurações ativas do WHAPI
    const { data: configurations, error: configError } = await supabase
      .from('whapi_configurations')
      .select('*')
      .eq('active', true)

    if (configError) throw configError

    const results = []

    for (const config of configurations || []) {
      try {
        // Buscar token do secret
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-secret', {
          body: { secretName: config.token_secret_name }
        })

        if (tokenError || !tokenData?.value) {
          results.push({
            id: config.id,
            name: config.name,
            type: config.type,
            phone_number: config.phone_number,
            status: 'unhealthy',
            error: 'Token não encontrado',
            checked_at: new Date().toISOString()
          })
          continue
        }

        // Testar conectividade com WHAPI
        const healthResponse = await fetch(`https://gate.whapi.cloud/health?token=${tokenData.value}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        })

        const isHealthy = healthResponse.ok
        let healthData = null

        try {
          healthData = await healthResponse.json()
        } catch (e) {
          console.log('Não foi possível parsear resposta de health como JSON')
        }

        // Atualizar status na configuração
        await supabase
          .from('whapi_configurations')
          .update({
            health_status: isHealthy ? 'healthy' : 'unhealthy',
            last_health_check: new Date().toISOString()
          })
          .eq('id', config.id)

        results.push({
          id: config.id,
          name: config.name,
          type: config.type,
          phone_number: config.phone_number,
          status: isHealthy ? 'healthy' : 'unhealthy',
          response_status: healthResponse.status,
          response_data: healthData,
          checked_at: new Date().toISOString()
        })

        console.log(`✅ ${config.name}: ${isHealthy ? 'Saudável' : 'Com problemas'}`)

      } catch (error) {
        console.error(`❌ Erro ao verificar ${config.name}:`, error)
        
        // Marcar como não saudável
        await supabase
          .from('whapi_configurations')
          .update({
            health_status: 'unhealthy',
            last_health_check: new Date().toISOString()
          })
          .eq('id', config.id)

        results.push({
          id: config.id,
          name: config.name,
          type: config.type,
          phone_number: config.phone_number,
          status: 'unhealthy',
          error: error.message,
          checked_at: new Date().toISOString()
        })
      }
    }

    // Log do resultado
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'whapi-health-check',
      message: 'Verificação de saúde do WHAPI concluída',
      details: {
        total_checked: results.length,
        healthy: results.filter(r => r.status === 'healthy').length,
        unhealthy: results.filter(r => r.status === 'unhealthy').length,
        results: results
      }
    })

    console.log(`🏥 Verificação concluída: ${results.filter(r => r.status === 'healthy').length}/${results.length} saudáveis`)

    return new Response(
      JSON.stringify({
        success: true,
        checked_at: new Date().toISOString(),
        results: results,
        summary: {
          total: results.length,
          healthy: results.filter(r => r.status === 'healthy').length,
          unhealthy: results.filter(r => r.status === 'unhealthy').length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro na verificação de saúde:', error)
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'whapi-health-check',
      message: 'Erro na verificação de saúde do WHAPI',
      details: { error: error.message }
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
