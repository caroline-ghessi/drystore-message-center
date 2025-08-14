import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting store (in-memory for simplicity)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now()
  const key = `${ip}_${Math.floor(now / windowMs)}`
  
  const current = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs }
  
  if (current.count >= limit) {
    return false
  }
  
  current.count++
  rateLimitStore.set(key, current)
  
  // Cleanup old entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetTime < now) {
      rateLimitStore.delete(k)
    }
  }
  
  return true
}

interface WhapiMessage {
  id: string;
  from: string;
  to: string;
  body?: string;
  type: string;
  timestamp: number;
  media?: {
    url?: string;
    mimetype?: string;
    filename?: string;
  };
  quoted?: string;
}

interface WhapiWebhook {
  event: string;
  instance_id: string;
  messages?: WhapiMessage[];
  statuses?: Array<{
    id: string;
    status: string;
    timestamp: number;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Rate limiting
  const clientIp = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(clientIp, 100, 60000)) {
    return new Response('Rate limit exceeded', { 
      status: 429, 
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Extrair seller_id do query parameter se presente
    const url = new URL(req.url)
    const sellerId = url.searchParams.get('seller_id')

    const webhook: WhapiWebhook = await req.json()
    console.log('WHAPI Webhook recebido:', JSON.stringify(webhook, null, 2))
    
    if (sellerId) {
      console.log('Webhook direcionado para vendedor:', sellerId)
    }

    // Log do webhook recebido
    await supabase.from('webhook_logs').insert({
      method: 'POST',
      url: '/whapi-webhook',
      source: 'whapi',
      body: webhook,
      response_status: 200
    })

    // Processar mensagens
    if (webhook.event === 'messages' && webhook.messages) {
      for (const message of webhook.messages) {
        await processMessage(supabase, message, sellerId)
      }
    }

    // Processar status de entrega
    if (webhook.event === 'statuses' && webhook.statuses) {
      for (const status of webhook.statuses) {
        await processMessageStatus(supabase, status)
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: webhook.messages?.length || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro no webhook WHAPI:', error)
    
    // Log do erro
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'whapi-webhook',
      message: 'Erro ao processar webhook WHAPI',
      details: { error: error.message, stack: error.stack }
    })

    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function processMessage(supabase: any, message: WhapiMessage, sellerId?: string | null) {
  try {
    console.log('Processando mensagem WHAPI:', message)

    let sellerFrom = null;
    let sellerTo = null;

    // Normalizar números de telefone (remover formatação)
    const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
    const messageFromNormalized = normalizePhone(message.from);
    const messageToNormalized = normalizePhone(message.to);

    // Se temos seller_id específico, usar ele diretamente
    if (sellerId) {
      const { data: specificSeller } = await supabase
        .from('sellers')
        .select('id, name, phone_number')
        .eq('id', sellerId)
        .single()
      
      if (specificSeller) {
        const sellerPhoneNormalized = normalizePhone(specificSeller.phone_number);
        
        if (messageFromNormalized === sellerPhoneNormalized || 
            messageFromNormalized.endsWith(sellerPhoneNormalized) ||
            sellerPhoneNormalized.endsWith(messageFromNormalized)) {
          sellerFrom = specificSeller;
        } else if (messageToNormalized === sellerPhoneNormalized ||
                   messageToNormalized.endsWith(sellerPhoneNormalized) ||
                   sellerPhoneNormalized.endsWith(messageToNormalized)) {
          sellerTo = specificSeller;
        }
      }
    } else {
      // Buscar vendedor por número - com normalização flexível
      const { data: allSellers } = await supabase
        .from('sellers')
        .select('id, name, phone_number')
        .eq('active', true)
        .eq('deleted', false)

      for (const seller of allSellers || []) {
        const sellerPhoneNormalized = normalizePhone(seller.phone_number);
        
        // Verificar se mensagem é DO vendedor
        if (messageFromNormalized === sellerPhoneNormalized || 
            messageFromNormalized.endsWith(sellerPhoneNormalized) ||
            sellerPhoneNormalized.endsWith(messageFromNormalized)) {
          sellerFrom = seller;
          break;
        }
        
        // Verificar se mensagem é PARA o vendedor
        if (messageToNormalized === sellerPhoneNormalized ||
            messageToNormalized.endsWith(sellerPhoneNormalized) ||
            sellerPhoneNormalized.endsWith(messageToNormalized)) {
          sellerTo = seller;
          break;
        }
      }
    }

    if (sellerFrom) {
      // Mensagem enviada PELO vendedor PARA o cliente
      await processSellerToCustomerMessage(supabase, sellerFrom, message)
    } else if (sellerTo) {
      // Mensagem enviada pelo cliente PARA o vendedor
      await processCustomerToSellerMessage(supabase, sellerTo, message)
    } else {
      // Verificar se é do Rodrigo Bot
      const rodrigoConfig = await supabase
        .from('whapi_configurations')
        .select('*')
        .eq('type', 'rodrigo_bot')
        .eq('phone_number', message.from)
        .single()

      if (rodrigoConfig.data) {
        console.log('Mensagem enviada pelo Rodrigo Bot (uso interno):', message)
        // Rodrigo Bot apenas ENVIA mensagens, não processa recebidas
      } else {
        console.log('Mensagem de número não identificado:', message.from, message.to)
      }
    }

    // Log da mensagem WHAPI
    await supabase.from('whapi_logs').insert({
      direction: sellerFrom ? 'sent' : 'received',
      phone_from: message.from,
      phone_to: message.to,
      content: message.body || '',
      message_type: message.type,
      media_url: message.media?.url,
      whapi_message_id: message.id,
      seller_id: sellerFrom?.id || sellerTo?.id,
      metadata: {
        webhook_timestamp: message.timestamp,
        media: message.media,
        quoted: message.quoted
      }
    })

  } catch (error) {
    console.error('Erro ao processar mensagem:', error)
  }
}

async function processSellerToCustomerMessage(supabase: any, seller: any, message: WhapiMessage) {
  console.log(`Mensagem do vendedor ${seller.name} para cliente ${message.to}`)

  // Normalizar número do cliente
  const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
  const clientPhoneNormalized = normalizePhone(message.to);

  // Buscar lead ativo do vendedor com este cliente (busca flexível por telefone)
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('seller_id', seller.id)
    .in('status', ['attending', 'sent_to_seller'])
    .order('created_at', { ascending: false })

  let matchingLead = null;
  
  // Encontrar lead que corresponde ao número (com normalização)
  for (const lead of leads || []) {
    const leadPhoneNormalized = normalizePhone(lead.phone_number);
    if (leadPhoneNormalized === clientPhoneNormalized ||
        leadPhoneNormalized.endsWith(clientPhoneNormalized) ||
        clientPhoneNormalized.endsWith(leadPhoneNormalized)) {
      matchingLead = lead;
      break;
    }
  }

  if (matchingLead) {
    // Salvar mensagem na conversa
    await supabase.from('messages').insert({
      conversation_id: matchingLead.conversation_id,
      sender_type: 'seller',
      sender_name: seller.name,
      content: message.body || '',
      message_type: message.type,
      media_url: message.media?.url,
      message_source: 'whapi',
      whatsapp_message_id: message.id,
      metadata: {
        whapi_message_id: message.id,
        seller_id: seller.id,
        customer_phone: message.to
      }
    })

    // Atualizar timestamp do lead e conversa
    await supabase
      .from('leads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', matchingLead.id)

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', matchingLead.conversation_id)

    console.log('Mensagem do vendedor salva na conversa:', matchingLead.conversation_id)
  } else {
    console.log('Lead não encontrado para vendedor e cliente:', seller.id, message.to)
    
    // Log para debugging
    await supabase.from('system_logs').insert({
      type: 'warning',
      source: 'whapi-webhook',
      message: 'Mensagem de vendedor sem lead correspondente',
      details: {
        seller_id: seller.id,
        seller_name: seller.name,
        customer_phone: message.to,
        message_id: message.id,
        available_leads: leads?.length || 0
      }
    })
  }
}

async function processCustomerToSellerMessage(supabase: any, seller: any, message: WhapiMessage) {
  console.log(`Mensagem do cliente ${message.from} para vendedor ${seller.name}`)

  // Normalizar número do cliente
  const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
  const clientPhoneNormalized = normalizePhone(message.from);

  // Buscar lead ativo do vendedor com este cliente (busca flexível por telefone)
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('seller_id', seller.id)
    .in('status', ['attending', 'sent_to_seller'])
    .order('created_at', { ascending: false })

  let matchingLead = null;
  
  // Encontrar lead que corresponde ao número (com normalização)
  for (const lead of leads || []) {
    const leadPhoneNormalized = normalizePhone(lead.phone_number);
    if (leadPhoneNormalized === clientPhoneNormalized ||
        leadPhoneNormalized.endsWith(clientPhoneNormalized) ||
        clientPhoneNormalized.endsWith(leadPhoneNormalized)) {
      matchingLead = lead;
      break;
    }
  }

  if (matchingLead) {
    // Salvar mensagem na conversa
    await supabase.from('messages').insert({
      conversation_id: matchingLead.conversation_id,
      sender_type: 'customer',
      sender_name: matchingLead.customer_name,
      content: message.body || '',
      message_type: message.type,
      media_url: message.media?.url,
      message_source: 'whapi',
      whatsapp_message_id: message.id,
      metadata: {
        whapi_message_id: message.id,
        from_phone: message.from
      }
    })

    // Atualizar timestamp do lead e conversa
    await supabase
      .from('leads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', matchingLead.id)

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', matchingLead.conversation_id)

    console.log('Mensagem do cliente salva na conversa:', matchingLead.conversation_id)
  } else {
    console.log('Lead não encontrado para cliente e vendedor:', message.from, seller.id)
    
    // Log para debugging
    await supabase.from('system_logs').insert({
      type: 'warning',
      source: 'whapi-webhook',
      message: 'Mensagem de cliente sem lead correspondente',
      details: {
        seller_id: seller.id,
        seller_name: seller.name,
        customer_phone: message.from,
        message_id: message.id,
        available_leads: leads?.length || 0
      }
    })
  }
}

async function processMessageStatus(supabase: any, status: any) {
  console.log('Processando status de mensagem:', status)

  // Atualizar status na tabela whapi_logs
  await supabase
    .from('whapi_logs')
    .update({ status: status.status })
    .eq('whapi_message_id', status.id)
}