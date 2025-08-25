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

    const body = await req.json()
    console.log('📥 WHAPI Webhook recebido:', JSON.stringify(body, null, 2))

    // Extrair seller_id da URL se presente
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const sellerId = pathParts[pathParts.length - 1] // último segmento da URL

    // Processar atualizações de status de mensagens
    if (body.statuses && Array.isArray(body.statuses)) {
      for (const status of body.statuses) {
        await processMessageStatus(supabase, status)
      }
    }

    // Processar mensagens (formato correto)
    if (body.messages && Array.isArray(body.messages)) {
      for (const message of body.messages) {
        await processMessage(supabase, message, sellerId)
      }
    }

    return new Response('OK', { 
      status: 200,
      headers: corsHeaders 
    })

  } catch (error) {
    console.error('❌ Erro no webhook WHAPI:', error)
    
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Função para processar atualizações de status de mensagens
async function processMessageStatus(supabase: any, status: any) {
  try {
    // Mapear códigos de status WHAPI para nossos status
    const statusMap: { [key: number]: string } = {
      1: 'sent',       // enviado
      2: 'delivered',  // entregue
      3: 'read',       // lido
      4: 'read'        // lido (confirmação dupla)
    }

    const deliveryStatus = statusMap[status.code] || 'sent'

    // Atualizar mensagem no banco
    const { error } = await supabase
      .from('messages')
      .update({
        delivery_status: deliveryStatus,
        updated_at: new Date().toISOString()
      })
      .eq('whatsapp_message_id', status.id)

    if (error) {
      console.error('Erro ao atualizar status da mensagem:', error)
    } else {
      console.log(`✅ Status da mensagem ${status.id} atualizado para: ${deliveryStatus}`)
    }

    // Log no whapi_logs se necessário
    await supabase
      .from('whapi_logs')
      .update({
        status: deliveryStatus,
        metadata: {
          ...status,
          status_updated_at: new Date().toISOString()
        }
      })
      .eq('whapi_message_id', status.id)

  } catch (error) {
    console.error('Erro ao processar status da mensagem:', error)
  }
}

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

    // IDENTIFICAR VENDEDOR CORRETAMENTE
    
    // 1️⃣ Se temos seller_id específico (webhook direcionado), usar ele diretamente
    if (sellerId) {
      const { data: specificSeller } = await supabase
        .from('sellers')
        .select('id, name, phone_number, whapi_token_secret_name')
        .eq('id', sellerId)
        .eq('active', true)
        .single()
      
      seller = specificSeller
    } else {
      // 2️⃣ Identificar vendedor pelo token/configuração WHAPI
      // Buscar configuração WHAPI que enviou esta mensagem
      const { data: whapiConfig } = await supabase
        .from('whapi_configurations')
        .select(`
          id,
          seller_id,
          phone_number,
          sellers!inner(id, name, phone_number, whapi_token_secret_name)
        `)
        .eq('type', 'seller')
        .eq('active', true)
        .not('seller_id', 'is', null)

      // Encontrar o vendedor correto com base no contexto da mensagem
      for (const config of whapiConfig || []) {
        // Normalizar números (remover espaços e caracteres especiais)
        const configPhone = config.phone_number?.replace(/\D/g, '')
        const messageFrom = message.from?.replace(/\D/g, '')
        
        if (message.from_me) {
          // Mensagem enviada: encontrar por número do remetente
          if (configPhone === messageFrom) {
            seller = config.sellers
            break
          }
        } else {
          // Mensagem recebida: buscar lead existente ou usar configuração ativa
          const { data: existingLead } = await supabase
            .from('leads')
            .select(`
              id,
              seller_id,
              sellers!inner(id, name, phone_number)
            `)
            .eq('phone_number', customerPhone)
            .eq('seller_id', config.seller_id)
            .in('status', ['attending', 'sent_to_seller'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (existingLead?.sellers) {
            seller = existingLead.sellers
            break
          }
        }
      }

      // 3️⃣ Fallback: buscar vendedor diretamente pelo número
      if (!seller) {
        const normalizedFrom = message.from?.replace(/\D/g, '')
        const { data: directSeller } = await supabase
          .from('sellers')
          .select('id, name, phone_number, whapi_token_secret_name')
          .eq('active', true)
          .not('whapi_token_secret_name', 'is', null)
        
        for (const sellerData of directSeller || []) {
          const sellerPhone = sellerData.phone_number?.replace(/\D/g, '')
          if (sellerPhone === normalizedFrom) {
            seller = sellerData
            break
          }
        }
      }
    }

    // PROCESSAR MENSAGEM DO VENDEDOR
    if (seller) {
      console.log(`Vendedor identificado: ${seller.name} (${seller.phone_number})`)
      
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
  console.log(`📤 Mensagem do vendedor ${seller.name} para cliente ${customerPhone}`)

  // 1️⃣ BUSCAR CONVERSA EXISTENTE (primeiro do bot, depois do vendedor)
  let conversation = null
  let lead = null

  // Buscar conversa existente do cliente (pode ser do bot ou já do vendedor)
  const { data: existingConversation } = await supabase
    .from('conversations')
    .select('id, customer_name, phone_number, status, assigned_seller_id')
    .eq('phone_number', customerPhone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingConversation) {
    conversation = existingConversation
    
    // Buscar ou criar lead para esta conversa
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, conversation_id, seller_id, status')
      .eq('conversation_id', conversation.id)
      .eq('seller_id', seller.id)
      .maybeSingle()

    if (existingLead) {
      lead = existingLead
    } else {
      // Criar lead para conversa existente (transição bot → vendedor)
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          conversation_id: conversation.id,
          seller_id: seller.id,
          customer_name: conversation.customer_name || message.from_name || customerPhone,
          phone_number: customerPhone,
          product_interest: 'Atendimento transferido para vendedor',
          summary: 'Lead criado na transição bot→vendedor via WHAPI',
          status: 'attending'
        })
        .select()
        .single()

      lead = newLead
      console.log(`📋 Lead criado para conversa existente: ${lead.id}`)
    }

    // Atualizar conversa para status "sent_to_seller" e associar vendedor
    await supabase
      .from('conversations')
      .update({
        status: 'sent_to_seller',
        assigned_seller_id: seller.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation.id)

  } else {
    // 2️⃣ CRIAR NOVA CONVERSA + LEAD (conversa iniciada pelo vendedor)
    console.log(`🆕 Criando nova conversa/lead - vendedor ${seller.name} iniciou contato com ${customerPhone}`)
    
    const { data: newConversation } = await supabase
      .from('conversations')
      .insert({
        phone_number: customerPhone,
        customer_name: message.from_name || `Cliente ${customerPhone.slice(-4)}`,
        status: 'sent_to_seller',
        assigned_seller_id: seller.id
      })
      .select()
      .single()

    if (newConversation) {
      conversation = newConversation
      
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          conversation_id: conversation.id,
          seller_id: seller.id,
          customer_name: conversation.customer_name,
          phone_number: customerPhone,
          product_interest: 'Contato iniciado pelo vendedor',
          summary: 'Lead criado automaticamente - vendedor iniciou conversa via WHAPI',
          status: 'attending'
        })
        .select()
        .single()

      lead = newLead
      console.log(`🎯 Nova conversa/lead criados: ${conversation.id} / ${lead.id}`)
    }
  }

  // 3️⃣ SALVAR MENSAGEM DO VENDEDOR
  if (conversation && lead) {
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
        content = `[Localização]`
        break
      default:
        content = `[${message.type}]`
    }

    // Inserir mensagem do vendedor
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        whatsapp_message_id: message.id,
        sender_type: 'seller',
        sender_name: seller.name,
        content: content,
        message_type: messageType,
        media_url: mediaUrl,
        created_at: new Date(message.timestamp * 1000).toISOString(),
        delivery_status: 'sent',
        message_source: 'whapi',
        metadata: {
          seller_id: seller.id,
          chat_id: message.chat_id,
          from_me: message.from_me,
          whapi_original: message
        }
      })

    console.log(`✅ Mensagem do vendedor ${seller.name} salva para conversa ${conversation.id}`)
  }
}

async function processCustomerToSellerMessage(supabase: any, seller: any, message: WhapiMessage, customerPhone: string) {
  console.log(`📥 Mensagem do cliente ${customerPhone} para vendedor ${seller.name}`)

  // 1️⃣ BUSCAR CONVERSA E LEAD EXISTENTES
  const { data: existingLead } = await supabase
    .from('leads')
    .select(`
      id,
      conversation_id,
      status,
      conversations!inner(id, customer_name, phone_number, status)
    `)
    .eq('phone_number', customerPhone)
    .eq('seller_id', seller.id)
    .in('status', ['attending', 'sent_to_seller'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingLead && existingLead.conversations) {
    const conversation = existingLead.conversations
    
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
        content = `[Localização]`
        break
      default:
        content = `[${message.type}]`
    }

    // Inserir mensagem do cliente
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        whatsapp_message_id: message.id,
        sender_type: 'customer',
        sender_name: message.from_name || conversation.customer_name || customerPhone,
        content: content,
        message_type: messageType,
        media_url: mediaUrl,
        created_at: new Date(message.timestamp * 1000).toISOString(),
        delivery_status: 'delivered',
        message_source: 'whapi',
        metadata: {
          seller_id: seller.id,
          lead_id: existingLead.id,
          chat_id: message.chat_id,
          from_me: message.from_me,
          whapi_original: message
        }
      })

    console.log(`✅ Mensagem do cliente salva para conversa ${conversation.id} (Lead: ${existingLead.id})`)
  } else {
    console.log(`⚠️  Lead não encontrado para cliente ${customerPhone} com vendedor ${seller.name}`)
  }
}