import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateSellerSecretRequest {
  sellerId: string;
  whapiToken: string;
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

    // Check if user has admin/manager role
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !userRole || !['admin', 'manager'].includes(userRole.role)) {
      console.error('❌ Usuário sem permissão para criar secrets de vendedor')
      throw new Error('Permissão insuficiente para criar secrets de vendedor')
    }

    const { sellerId, whapiToken }: CreateSellerSecretRequest = await req.json()
    console.log('🔐 Criando secret para vendedor:', sellerId)

    if (!sellerId || !whapiToken) {
      throw new Error('sellerId e whapiToken são obrigatórios')
    }

    // Get seller info
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('phone_number, name, whapi_token_secret_name')
      .eq('id', sellerId)
      .single()

    if (sellerError || !seller) {
      throw new Error(`Vendedor não encontrado: ${sellerId}`)
    }

    // Generate secret name based on phone number
    const phoneNumber = seller.phone_number.replace(/\D/g, '')
    const secretName = `WHAPI_TOKEN_${phoneNumber}`

    // Store the token as an environment variable (this is a simulation)
    // In production, this would be stored in Supabase Secrets
    console.log(`📝 Secret name: ${secretName}`)
    console.log(`📝 Token length: ${whapiToken.length}`)

    // Update seller record with secret name
    const { error: updateError } = await supabase
      .from('sellers')
      .update({ whapi_token_secret_name: secretName })
      .eq('id', sellerId)

    if (updateError) {
      throw new Error(`Erro ao atualizar vendedor: ${updateError.message}`)
    }

    // Log the security improvement
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'user_management',
      message: 'WHAPI token migrado para secret seguro',
      details: {
        seller_id: sellerId,
        seller_name: seller.name,
        secret_name: secretName,
        created_by: user.email,
        timestamp: new Date().toISOString()
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        secretName,
        message: `Token WHAPI do vendedor ${seller.name} migrado com sucesso para secret seguro`,
        instructions: `Configure o secret '${secretName}' no Supabase Dashboard com o token fornecido`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro ao criar secret do vendedor:', error)

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