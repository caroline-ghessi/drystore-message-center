
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RetryMessageRequest {
  leadId?: string;
  sellerId?: string;
  customerPhone?: string;
  customMessage?: string;
  force?: boolean;
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

    const request: RetryMessageRequest = await req.json()
    console.log('🔄 Iniciando retry de mensagem:', request)

    let lead, seller, message;

    if (request.leadId) {
      // Buscar lead específico
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select(`
          *,
          sellers!inner(*)
        `)
        .eq('id', request.leadId)
        .single()

      if (leadError) throw leadError
      lead = leadData
      seller = leadData.sellers
      message = `🔄 *REENVIO DE LEAD*\n\n${lead.summary}`
    } else if (request.sellerId && request.customerPhone) {
      // Buscar vendedor
      const { data: sellerData, error: sellerError } = await supabase
        .from('sellers')
        .select('*')
        .eq('id', request.sellerId)
        .single()

      if (sellerError) throw sellerError
      seller = sellerData
      message = request.customMessage || 'Mensagem de teste do Rodrigo Bot'
    } else {
      throw new Error('leadId ou (sellerId + customerPhone) são obrigatórios')
    }

    // Buscar configuração do Rodrigo Bot
    const { data: rodrigoConfig, error: configError } = await supabase
      .from('whapi_configurations')
      .select('*')
      .eq('type', 'rodrigo_bot')
      .eq('active', true)
      .single()

    if (configError || !rodrigoConfig) {
      throw new Error('Rodrigo Bot não está configurado')
    }

    // Buscar token do Rodrigo Bot
    const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-secret', {
      body: { secretName: rodrigoConfig.token_secret_name }
    })

    if (tokenError || !tokenData?.value) {
      throw new Error(`Token do Rodrigo Bot não encontrado: ${rodrigoConfig.token_secret_name}`)
    }

    // Testar conectividade WHAPI primeiro
    const healthCheck = await fetch(`https://gate.whapi.cloud/health?token=${tokenData.value}`)
    if (!healthCheck.ok) {
      throw new Error('WHAPI não está respondendo. Verifique a conectividade.')
    }

    // Enviar mensagem via WHAPI
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('whapi-send', {
      body: {
        token: tokenData.value,
        to: seller.phone_number,
        content: message,
        type: 'text'
      }
    })

    if (sendError) {
      throw new Error(`Erro no envio: ${sendError.message}`)
    }

    if (!sendResult?.success) {
      throw new Error(`Falha no envio: ${sendResult?.error || 'Erro desconhecido'}`)
    }

    // Log do retry
    await supabase.from('system_logs').insert({
      type: 'success',
      source: 'retry-message',
      message: 'Mensagem reenviada com sucesso',
      details: {
        lead_id: request.leadId,
        seller_id: seller.id,
        seller_name: seller.name,
        seller_phone: seller.phone_number,
        customer_phone: request.customerPhone,
        message_id: sendResult.message_id,
        retry_reason: request.force ? 'manual_retry' : 'automatic_retry'
      }
    })

    // Atualizar lead se aplicável
    if (lead) {
      await supabase
        .from('leads')
        .update({
          sent_at: new Date().toISOString(),
          status: 'sent_to_seller'
        })
        .eq('id', lead.id)
    }

    console.log('✅ Mensagem reenviada com sucesso:', sendResult.message_id)

    return new Response(
      JSON.stringify({
        success: true,
        message_id: sendResult.message_id,
        seller: seller.name,
        phone: seller.phone_number,
        retry_type: request.force ? 'manual' : 'automatic'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro no retry de mensagem:', error)
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'retry-message',
      message: 'Erro no retry de mensagem',
      details: { 
        error: error.message,
        request: request
      }
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
