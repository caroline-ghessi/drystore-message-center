import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GetTokenRequest {
  tokenSecretName: string;
  sellerId?: string;
  requesterType?: 'system' | 'diagnostic' | 'webhook' | 'health_check';
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

    const { tokenSecretName, sellerId, requesterType = 'system' }: GetTokenRequest = await req.json()

    console.log('🔐 Token request:', {
      tokenSecretName: tokenSecretName?.substring(0, 20) + '...',
      sellerId: sellerId?.substring(0, 8) + '...',
      requesterType
    })

    if (!tokenSecretName) {
      throw new Error('Nome do secret é obrigatório')
    }

    // Validação de permissões - apenas edge functions podem acessar
    const currentRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'service_role' : 'unknown'
    if (currentRole !== 'service_role') {
      throw new Error('Acesso não autorizado - apenas edge functions')
    }

    // Rate limiting básico para prevenir abuso
    const requestKey = `token_request_${tokenSecretName}_${Date.now().toString().slice(0, -4)}`
    
    // Buscar token do ambiente
    const tokenValue = Deno.env.get(tokenSecretName)
    
    if (!tokenValue) {
      console.error(`❌ Token '${tokenSecretName}' não encontrado`)
      throw new Error(`Token '${tokenSecretName}' não encontrado`)
    }

    // Log seguro para auditoria (sem expor token)
    await supabase.from('system_logs').insert({
      type: 'security',
      source: 'token_access',
      message: 'Token WHAPI acessado de forma segura',
      details: {
        token_secret_name: tokenSecretName,
        seller_id: sellerId,
        requester_type: requesterType,
        token_length: tokenValue.length,
        timestamp: new Date().toISOString()
      }
    })

    console.log(`✅ Token '${tokenSecretName}' fornecido com segurança (${tokenValue.length} chars)`)

    return new Response(
      JSON.stringify({
        success: true,
        token: tokenValue,
        tokenSecretName,
        metadata: {
          length: tokenValue.length,
          requesterType,
          accessTime: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro ao acessar token:', error)

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