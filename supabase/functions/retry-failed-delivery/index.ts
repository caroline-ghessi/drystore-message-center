
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RetryRequest {
  deliveryId: string;
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

    const { deliveryId }: RetryRequest = await req.json()

    if (!deliveryId) {
      throw new Error('deliveryId é obrigatório')
    }

    // Buscar o delivery falhado
    const { data: delivery, error: deliveryError } = await supabase
      .from('whapi_logs')
      .select(`
        *,
        sellers!inner(name, phone_number)
      `)
      .eq('id', deliveryId)
      .single()

    if (deliveryError || !delivery) {
      throw new Error(`Delivery não encontrado: ${deliveryError?.message}`)
    }

    if (delivery.status !== 'failed') {
      throw new Error('Apenas deliveries falhados podem ser reenviados')
    }

    console.log('Reenviando delivery:', {
      id: delivery.id,
      seller: delivery.sellers?.name,
      phone: delivery.phone_to
    })

    // Buscar token do Rodrigo Bot
    const { data: rodrigoToken } = await supabase.functions.invoke('get-secret', {
      body: { secretName: 'WHAPI_TOKEN_5551981155622' }
    })

    if (!rodrigoToken?.value) {
      throw new Error('Token do Rodrigo Bot não encontrado')
    }

    // Reenviar via WHAPI
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('whapi-send', {
      body: {
        token: rodrigoToken.value,
        to: delivery.phone_to,
        content: `${delivery.content}\n\n⚠️ REENVIO - Mensagem anterior não foi entregue`
      }
    })

    if (sendError) {
      throw new Error(`Erro no reenvio: ${sendError.message}`)
    }

    // Atualizar o delivery original
    await supabase
      .from('whapi_logs')
      .update({
        status: 'retry_sent',
        metadata: {
          ...delivery.metadata,
          retry_count: (delivery.metadata?.retry_count || 0) + 1,
          last_retry: new Date().toISOString()
        }
      })
      .eq('id', deliveryId)

    // Criar novo log para o reenvio
    await supabase
      .from('whapi_logs')
      .insert({
        direction: 'sent',
        phone_from: delivery.phone_from,
        phone_to: delivery.phone_to,
        content: `${delivery.content}\n\n⚠️ REENVIO`,
        message_type: delivery.message_type,
        whapi_message_id: sendResult.message_id,
        token_used: rodrigoToken.value.substring(0, 10) + '...',
        status: 'sent',
        metadata: {
          is_retry: true,
          original_delivery_id: deliveryId,
          retry_count: (delivery.metadata?.retry_count || 0) + 1
        }
      })

    // Log do reenvio
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'retry-delivery',
        message: `Delivery reenviado para ${delivery.sellers?.name}`,
        details: {
          original_delivery_id: deliveryId,
          seller_name: delivery.sellers?.name,
          phone_number: delivery.phone_to,
          new_message_id: sendResult.message_id
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery reenviado com sucesso',
        seller_name: delivery.sellers?.name,
        new_message_id: sendResult.message_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro no reenvio:', error)
    
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
