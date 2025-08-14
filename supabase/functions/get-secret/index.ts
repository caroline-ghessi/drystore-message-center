
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GetSecretRequest {
  secretName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify JWT token and get user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Token de autorização é obrigatório')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('❌ Erro de autenticação:', authError)
      throw new Error('Token de autorização inválido')
    }

    // Check if user has admin role
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !userRole || !['admin', 'manager'].includes(userRole.role)) {
      console.error('❌ Usuário sem permissão para acessar secrets')
      throw new Error('Permissão insuficiente para acessar secrets')
    }

    const { secretName }: GetSecretRequest = await req.json()
    console.log('🔍 Buscando secret:', secretName, 'para usuário:', user.email)

    if (!secretName) {
      throw new Error('Nome do secret é obrigatório')
    }

    // Buscar secret do ambiente
    const secretValue = Deno.env.get(secretName)
    
    if (!secretValue) {
      console.error(`❌ Secret '${secretName}' não encontrado no ambiente`)
      throw new Error(`Secret '${secretName}' não encontrado`)
    }

    // Log adicional para debug - apenas primeiros e últimos caracteres por segurança
    const maskedValue = secretValue.length > 10 
      ? secretValue.substring(0, 5) + '...' + secretValue.substring(secretValue.length - 5)
      : secretValue.substring(0, 3) + '...';
    
    console.log(`✅ Secret '${secretName}' encontrado: ${maskedValue}`)
    console.log(`📏 Tamanho do token: ${secretValue.length} caracteres`)

    return new Response(
      JSON.stringify({
        success: true,
        value: secretValue,
        secretName,
        debug: {
          tokenLength: secretValue.length,
          tokenMasked: maskedValue
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro ao buscar secret:', error)

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
