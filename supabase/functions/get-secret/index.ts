
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const { secretName }: GetSecretRequest = await req.json()
    console.log('🔍 Buscando secret:', secretName)

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
