import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncHistoryRequest {
  sellerId?: string;
  limitChats?: number;
  limitMessages?: number;
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

    const { sellerId, limitChats = 50, limitMessages = 100 }: SyncHistoryRequest = await req.json()

    if (!sellerId) {
      return new Response(
        JSON.stringify({ error: 'sellerId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar token do vendedor
    const { data: tokenResponse } = await supabase.functions.invoke('get-secret', {
      body: { secretName: `WHAPI_TOKEN_${sellerId.toUpperCase().replace(/-/g, '_')}` }
    })

    if (!tokenResponse?.secret) {
      throw new Error('Token WHAPI não encontrado para este vendedor')
    }

    const token = tokenResponse.secret

    // 1. Buscar lista de chats
    const chatsResponse = await fetch('https://gate.whapi.cloud/chats', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        count: limitChats
      })
    })

    if (!chatsResponse.ok) {
      throw new Error(`Erro ao buscar chats: ${chatsResponse.status}`)
    }

    const chatsData = await chatsResponse.json()
    const chats = chatsData.chats || []
    
    let conversationsCreated = 0
    let messagesImported = 0

    // 2. Para cada chat individual (não grupos)
    for (const chat of chats) {
      // Filtrar apenas conversas individuais (não grupos)
      if (chat.id && !chat.id.includes('@g.us')) {
        try {
          // Buscar mensagens do chat
          const messagesResponse = await fetch('https://gate.whapi.cloud/messages/list', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              chat_id: chat.id,
              count: limitMessages
            })
          })

          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json()
            const messages = messagesData.messages || []

            if (messages.length > 0) {
              // Criar ou atualizar conversa
              const phoneNumber = chat.id.replace('@s.whatsapp.net', '')
              const customerName = chat.name || messages[0]?.from_name || phoneNumber

              const { data: conversation, error: convError } = await supabase
                .from('conversations')
                .upsert({
                  phone_number: phoneNumber,
                  customer_name: customerName,
                  status: 'bot_attending',
                  message_source: 'whapi_history',
                  last_message_at: new Date(Math.max(...messages.map(m => m.timestamp * 1000)))
                }, {
                  onConflict: 'phone_number',
                  ignoreDuplicates: false
                })
                .select()
                .single()

              if (convError) {
                console.error('Erro ao criar conversa:', convError)
                continue
              }

              conversationsCreated++

              // Inserir mensagens
              for (const message of messages) {
                // Processar diferentes tipos de conteúdo
                let content = ''
                let mediaUrl = null
                let messageType = 'text'

                if (message.text?.body) {
                  content = message.text.body
                  messageType = 'text'
                } else if (message.image) {
                  content = message.image.caption || '[Imagem]'
                  mediaUrl = message.image.link
                  messageType = 'image'
                } else if (message.video) {
                  content = message.video.caption || '[Vídeo]'
                  mediaUrl = message.video.link
                  messageType = 'video'
                } else if (message.audio || message.voice) {
                  content = '[Áudio]'
                  mediaUrl = (message.audio || message.voice).link
                  messageType = 'audio'
                } else if (message.document) {
                  content = message.document.filename || '[Documento]'
                  mediaUrl = message.document.link
                  messageType = 'document'
                }

                const { error: msgError } = await supabase
                  .from('messages')
                  .upsert({
                    conversation_id: conversation.id,
                    whatsapp_message_id: message.id,
                    sender_type: message.from_me ? 'seller' : 'customer',
                    sender_name: message.from_me ? 'Vendedor' : (message.from_name || customerName),
                    content: content,
                    message_type: messageType,
                    media_url: mediaUrl,
                    created_at: new Date(message.timestamp * 1000).toISOString(),
                    delivery_status: 'delivered',
                    message_source: 'whapi_history',
                    metadata: {
                      whapi_original: message,
                      sync_timestamp: new Date().toISOString()
                    }
                  }, {
                    onConflict: 'whatsapp_message_id',
                    ignoreDuplicates: true
                  })

                if (!msgError) {
                  messagesImported++
                }
              }
            }
          }

          // Pequeno delay entre requisições
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (chatError) {
          console.error(`Erro ao processar chat ${chat.id}:`, chatError)
        }
      }
    }

    // Log do resultado
    await supabase
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'whapi_sync',
        message: `Sincronização de histórico WHAPI concluída para vendedor ${sellerId}`,
        details: {
          seller_id: sellerId,
          conversations_created: conversationsCreated,
          messages_imported: messagesImported,
          chats_processed: chats.filter(c => !c.id?.includes('@g.us')).length
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronização concluída',
        statistics: {
          conversations_created: conversationsCreated,
          messages_imported: messagesImported,
          chats_processed: chats.filter(c => !c.id?.includes('@g.us')).length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro na sincronização WHAPI:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro na sincronização',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})