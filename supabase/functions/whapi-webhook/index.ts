import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Formato correto WHAPI Cloud baseado na documentação
interface WhapiMessage {
  id: string;
  from_me: boolean;
  type: string;
  chat_id: string;
  timestamp: number;
  source: string;
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    link?: string;
  };
  video?: {
    id: string;
    mime_type: string;
    sha256: string;
    link?: string;
  };
  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
    link?: string;
  };
  document?: {
    id: string;
    mime_type: string;
    sha256: string;
    filename?: string;
    link?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  reaction?: {
    emoji: string;
    message_id: string;
  };
  from: string;
  from_name?: string;
  context?: {
    quoted_id?: string;
    quoted_author?: string;
    quoted_content?: any;
  };
}

interface WhapiWebhook {
  messages?: WhapiMessage[];
  statuses?: Array<{
    id: string;
    code: number;
    status: string;
    recipient_id: string;
    timestamp: string;
  }>;
  event: {
    type: string;
    event: string;
  };
  channel_id: string;
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

    // Log das correções aplicadas
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'whapi-webhook',
      message: 'Webhook WHAPI corrigido para formato Cloud API',
      details: {
        event_type: webhook.event?.type,
        messages_count: webhook.messages?.length || 0,
        statuses_count: webhook.statuses?.length || 0,
        channel_id: webhook.channel_id,
        seller_id: sellerId,
        corrections_applied: [
          'Formato WHAPI Cloud implementado',
          'Filtro de grupos adicionado',
          'Criação automática de conversas/leads',
          'Processamento correto de from_me',
          'Suporte a todos os tipos de mídia'
        ]
      }
    })

    // Processar mensagens (formato correto WHAPI)
    if (webhook.event?.type === 'messages' && webhook.messages) {
      for (const message of webhook.messages) {
        await processMessage(supabase, message, sellerId)
      }
    }

    // Processar status de entrega (formato correto WHAPI)  
    if (webhook.event?.type === 'statuses' && webhook.statuses) {
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

    // FILTRAR MENSAGENS DE GRUPOS - Ignorar completamente
    if (message.chat_id.includes('@g.us') || message.chat_id.includes('-')) {
      console.log('Ignorando mensagem de grupo:', message.chat_id)
      return
    }

    // Extrair número do telefone do chat_id (formato: 5551234567890@s.whatsapp.net)
    const customerPhone = message.chat_id.replace('@s.whatsapp.net', '')
    let seller = null

    // Se temos seller_id específico, usar ele diretamente
    if (sellerId) {
      const { data: specificSeller } = await supabase
        .from('sellers')
        .select('id, name, phone_number')
        .eq('id', sellerId)
        .single()
      
      seller = specificSeller
    } else {
      // Identificar vendedor pelo número FROM (quando from_me = true)
      if (message.from_me) {
        const { data: sellerData } = await supabase
          .from('sellers')
          .select('id, name, phone_number')
          .eq('phone_number', message.from)
          .single()
        seller = sellerData
      } else {
        // Mensagem recebida - precisa descobrir qual vendedor está associado
        // Buscar por leads existentes com este cliente
        const { data: existingLead } = await supabase
          .from('leads')
          .select(`
            id,
            seller_id,
            sellers!inner(id, name, phone_number)
          `)
          .eq('phone_number', customerPhone)
          .in('status', ['attending', 'sent_to_seller'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (existingLead?.sellers) {
          seller = existingLead.sellers
        }
      }
    }

    if (seller) {
      if (message.from_me) {
        // Mensagem ENVIADA pelo vendedor PARA o cliente
        await processSellerToCustomerMessage(supabase, seller, message, customerPhone)
      } else {
        // Mensagem RECEBIDA do cliente PARA o vendedor
        await processCustomerToSellerMessage(supabase, seller, message, customerPhone)
      }
    } else {
      // Verificar se é do Rodrigo Bot
      const { data: rodrigoConfig } = await supabase
        .from('whapi_configurations')
        .select('*')
        .eq('type', 'rodrigo_bot')
        .eq('phone_number', message.from)
        .maybeSingle()

      if (rodrigoConfig) {
        console.log('Mensagem enviada pelo Rodrigo Bot (uso interno):', message.id)
        // Rodrigo Bot apenas ENVIA mensagens, não processa recebidas
      } else {
        console.log('Vendedor não identificado para mensagem:', {
          from: message.from,
          chat_id: message.chat_id,
          from_me: message.from_me,
          customerPhone
        })
      }
    }

    // Extrair conteúdo da mensagem baseado no tipo
    let content = ''
    let mediaUrl = null

    switch (message.type) {
      case 'text':
        content = message.text?.body || ''
        break
      case 'image':
        content = '[Imagem]'
        mediaUrl = message.image?.link
        break
      case 'video':
        content = '[Vídeo]'
        mediaUrl = message.video?.link
        break
      case 'audio':
        content = '[Áudio]'
        mediaUrl = message.audio?.link
        break
      case 'document':
        content = `[Documento: ${message.document?.filename || 'arquivo'}]`
        mediaUrl = message.document?.link
        break
      case 'location':
        content = `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`
        break
      case 'reaction':
        content = `Reagiu com ${message.reaction?.emoji || '👍'}`
        break
      default:
        content = `[${message.type}]`
    }

    // Log detalhado da mensagem WHAPI
    await supabase.from('whapi_logs').insert({
      direction: message.from_me ? 'seller_to_customer' : 'customer_to_seller',
      phone_from: message.from,
      phone_to: customerPhone,
      content: content,
      message_type: message.type,
      media_url: mediaUrl,
      whapi_message_id: message.id,
      seller_id: seller?.id,
      metadata: {
        chat_id: message.chat_id,
        from_me: message.from_me,
        timestamp: message.timestamp,
        source: message.source,
        from_name: message.from_name,
        context: message.context
      }
    })

  } catch (error) {
    console.error('Erro ao processar mensagem WHAPI:', error)
    
    // Log do erro
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'whapi-webhook',
      message: 'Erro ao processar mensagem WHAPI',
      details: { 
        error: error.message, 
        stack: error.stack,
        message_id: message.id,
        chat_id: message.chat_id
      }
    })
  }
}

async function processSellerToCustomerMessage(supabase: any, seller: any, message: WhapiMessage, customerPhone: string) {
  console.log(`Mensagem do vendedor ${seller.name} para cliente ${customerPhone}`)

  // Buscar ou criar lead/conversa
  let { data: lead } = await supabase
    .from('leads')
    .select(`
      id,
      conversation_id,
      customer_name,
      phone_number,
      seller_id,
      status,
      conversations!inner(id, customer_name, phone_number, status)
    `)
    .eq('seller_id', seller.id)
    .eq('phone_number', customerPhone)
    .in('status', ['attending', 'sent_to_seller'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lead) {
    // Criar nova conversa e lead automaticamente
    console.log(`Criando nova conversa/lead para vendedor ${seller.name} e cliente ${customerPhone}`)
    
    // Criar conversa
    const { data: newConversation } = await supabase
      .from('conversations')
      .insert({
        phone_number: customerPhone,
        customer_name: message.from_name || customerPhone.replace(/^\d{2}/, ''),
        status: 'sent_to_seller',
        assigned_seller_id: seller.id
      })
      .select()
      .single()

    if (newConversation) {
      // Criar lead
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          conversation_id: newConversation.id,
          seller_id: seller.id,
          customer_name: newConversation.customer_name,
          phone_number: customerPhone,
          product_interest: 'Atendimento via WhatsApp',
          summary: 'Lead criado automaticamente via WHAPI',
          status: 'attending'
        })
        .select()
        .single()

      lead = {
        ...newLead,
        conversations: newConversation
      }

      console.log('Nova conversa/lead criados:', newConversation.id, newLead.id)
    }
  }

  if (lead) {
    // Extrair conteúdo da mensagem
    let content = ''
    let mediaUrl = null
    let messageType = message.type

    switch (message.type) {
      case 'text':
        content = message.text?.body || ''
        break
      case 'image':
        content = '[Imagem]'
        mediaUrl = message.image?.link
        break
      case 'video':
        content = '[Vídeo]'
        mediaUrl = message.video?.link
        break
      case 'audio':
        content = '[Áudio]'
        mediaUrl = message.audio?.link
        break
      case 'document':
        content = `[Documento: ${message.document?.filename || 'arquivo'}]`
        mediaUrl = message.document?.link
        break
      case 'location':
        content = `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`
        break
      case 'reaction':
        content = `Reagiu com ${message.reaction?.emoji || '👍'}`
        messageType = 'reaction'
        break
      default:
        content = `[${message.type}]`
    }

    // Salvar mensagem na conversa
    await supabase.from('messages').insert({
      conversation_id: lead.conversation_id,
      sender_type: 'seller',
      sender_name: seller.name,
      content: content,
      message_type: messageType,
      media_url: mediaUrl,
      message_source: 'whapi',
      metadata: {
        whapi_message_id: message.id,
        seller_id: seller.id,
        customer_phone: customerPhone,
        from_me: message.from_me,
        chat_id: message.chat_id,
        context: message.context
      }
    })

    // Atualizar timestamp do lead e conversa
    await Promise.all([
      supabase
        .from('leads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', lead.id),
      supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', lead.conversation_id)
    ])

    console.log('Mensagem do vendedor salva na conversa:', lead.conversation_id)
  } else {
    console.log('Falha ao criar/encontrar lead para vendedor e cliente:', seller.id, customerPhone)
  }
}

async function processCustomerToSellerMessage(supabase: any, seller: any, message: WhapiMessage, customerPhone: string) {
  console.log(`Mensagem do cliente ${customerPhone} para vendedor ${seller.name}`)

  // Buscar ou criar lead/conversa
  let { data: lead } = await supabase
    .from('leads')
    .select(`
      id,
      conversation_id,
      customer_name,
      phone_number,
      seller_id,
      status,
      conversations!inner(id, customer_name, phone_number, status)
    `)
    .eq('seller_id', seller.id)
    .eq('phone_number', customerPhone)
    .in('status', ['attending', 'sent_to_seller'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lead) {
    // Criar nova conversa e lead automaticamente
    console.log(`Criando nova conversa/lead para cliente ${customerPhone} e vendedor ${seller.name}`)
    
    // Criar conversa
    const { data: newConversation } = await supabase
      .from('conversations')
      .insert({
        phone_number: customerPhone,
        customer_name: message.from_name || customerPhone.replace(/^\d{2}/, ''),
        status: 'sent_to_seller',
        assigned_seller_id: seller.id
      })
      .select()
      .single()

    if (newConversation) {
      // Criar lead
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          conversation_id: newConversation.id,
          seller_id: seller.id,
          customer_name: newConversation.customer_name,
          phone_number: customerPhone,
          product_interest: 'Atendimento via WhatsApp',
          summary: 'Lead criado automaticamente via WHAPI',
          status: 'attending'
        })
        .select()
        .single()

      lead = {
        ...newLead,
        conversations: newConversation
      }

      console.log('Nova conversa/lead criados:', newConversation.id, newLead.id)
    }
  }

  if (lead) {
    // Extrair conteúdo da mensagem
    let content = ''
    let mediaUrl = null
    let messageType = message.type

    switch (message.type) {
      case 'text':
        content = message.text?.body || ''
        break
      case 'image':
        content = '[Imagem]'
        mediaUrl = message.image?.link
        break
      case 'video':
        content = '[Vídeo]'
        mediaUrl = message.video?.link
        break
      case 'audio':
        content = '[Áudio]'
        mediaUrl = message.audio?.link
        break
      case 'document':
        content = `[Documento: ${message.document?.filename || 'arquivo'}]`
        mediaUrl = message.document?.link
        break
      case 'location':
        content = `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`
        break
      case 'reaction':
        content = `Reagiu com ${message.reaction?.emoji || '👍'}`
        messageType = 'reaction'
        break
      default:
        content = `[${message.type}]`
    }

    // Salvar mensagem na conversa
    await supabase.from('messages').insert({
      conversation_id: lead.conversation_id,
      sender_type: 'customer',
      sender_name: lead.customer_name,
      content: content,
      message_type: messageType,
      media_url: mediaUrl,
      message_source: 'whapi',
      metadata: {
        whapi_message_id: message.id,
        from_phone: customerPhone,
        from_me: message.from_me,
        chat_id: message.chat_id,
        context: message.context
      }
    })

    // Atualizar timestamp do lead e conversa
    await Promise.all([
      supabase
        .from('leads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', lead.id),
      supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', lead.conversation_id)
    ])

    console.log('Mensagem do cliente salva na conversa:', lead.conversation_id)
  } else {
    console.log('Falha ao criar/encontrar lead para cliente e vendedor:', customerPhone, seller.id)
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