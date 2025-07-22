
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RetryDeliveryRequest {
  deliveryId: string;
  force?: boolean;
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

    const { deliveryId, force = false }: RetryDeliveryRequest = await req.json()

    if (!deliveryId) {
      throw new Error('deliveryId é obrigatório')
    }

    // Buscar a mensagem falhada
    const { data: failedMessage, error: fetchError } = await supabase
      .from('whapi_logs')
      .select(`
        *,
        sellers!inner(name, phone_number)
      `)
      .eq('id', deliveryId)
      .single()

    if (fetchError || !failedMessage) {
      throw new Error(`Mensagem não encontrada: ${fetchError?.message}`)
    }

    // Verificar se pode reenviar
    if (!force && failedMessage.status !== 'failed') {
      throw new Error(`Mensagem não está marcada como falhada. Status atual: ${failedMessage.status}`)
    }

    // Verificar quantas tentativas já foram feitas
    const retryCount = (failedMessage.metadata as any)?.retry_count || 0
    if (!force && retryCount >= 3) {
      throw new Error('Número máximo de tentativas excedido (3)')
    }

    console.log('Reenviando mensagem falhada:', {
      id: deliveryId,
      to: failedMessage.phone_to,
      retry_count: retryCount,
      seller: failedMessage.sellers?.name
    })

    // Reenviar usando whapi-send
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('whapi-send', {
      body: {
        token: failedMessage.token_used,
        to: failedMessage.phone_to,
        content: failedMessage.content,
        type: failedMessage.message_type || 'text',
        media: failedMessage.media_url ? { url: failedMessage.media_url } : undefined
      }
    })

    if (sendError) {
      throw new Error(`Erro no reenvio: ${sendError.message}`)
    }

    if (!sendResult?.success) {
      throw new Error(`Falha no reenvio: ${sendResult?.error}`)
    }

    // Atualizar o registro original com informações do retry
    await supabase
      .from('whapi_logs')
      .update({
        status: 'retry_sent',
        metadata: {
          ...failedMessage.metadata,
          retry_count: retryCount + 1,
          retry_at: new Date().toISOString(),
          retry_message_id: sendResult.message_id,
          original_error: failedMessage.error_message
        },
        error_message: null
      })
      .eq('id', deliveryId)

    // Log do retry
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'retry_delivery',
        message: `Mensagem reenviada com sucesso para ${failedMessage.sellers?.name}`,
        details: {
          original_id: deliveryId,
          new_message_id: sendResult.message_id,
          retry_count: retryCount + 1,
          seller_name: failedMessage.sellers?.name,
          phone_to: failedMessage.phone_to
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Mensagem reenviada para ${failedMessage.sellers?.name}`,
        new_message_id: sendResult.message_id,
        retry_count: retryCount + 1,
        seller: failedMessage.sellers?.name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro no retry de entrega:', error)
    
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
