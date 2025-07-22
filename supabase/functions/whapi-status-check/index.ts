import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StatusCheckRequest {
  whapiMessageId: string;
  token: string;
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

    const { whapiMessageId, token }: StatusCheckRequest = await req.json()

    if (!whapiMessageId || !token) {
      return new Response(
        JSON.stringify({ error: 'whapiMessageId e token são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar status na API WHAPI
    const whapiResponse = await fetch(`https://gate.whapi.cloud/messages/${whapiMessageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!whapiResponse.ok) {
      throw new Error(`WHAPI status check failed: ${whapiResponse.status}`)
    }

    const statusData = await whapiResponse.json()
    
    // Atualizar status no banco de dados
    const { error: updateError } = await supabase
      .from('whapi_logs')
      .update({ 
        status: statusData.status || 'unknown',
        metadata: {
          ...statusData,
          last_status_check: new Date().toISOString()
        }
      })
      .eq('whapi_message_id', whapiMessageId)

    if (updateError) {
      throw updateError
    }

    // Log da verificação
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'whapi_status_check',
        message: `Status verificado para mensagem ${whapiMessageId}: ${statusData.status}`,
        details: {
          message_id: whapiMessageId,
          status: statusData.status,
          whapi_response: statusData
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        message_id: whapiMessageId,
        status: statusData.status,
        details: statusData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro na verificação de status WHAPI:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro na verificação de status',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})