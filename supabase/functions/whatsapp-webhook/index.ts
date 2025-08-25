import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookMessage {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: {
            body: string;
          };
          type: string;
          audio?: any;
          document?: any;
          image?: any;
          video?: any;
          voice?: any;
          location?: any;
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const url = new URL(req.url);
    
    // Handle webhook verification (GET request)
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('Webhook verification attempt:', { mode, token, challenge });

      // Get verification token from database
      const { data: integration, error: dbError } = await supabase
        .from('integrations')
        .select('config')
        .eq('type', 'meta')
        .eq('name', 'WhatsApp Business Meta')
        .single();

      const verifyToken = integration?.config?.webhook_verify_token;
      
      console.log('Webhook verification details:', {
        mode,
        token,
        challenge,
        verifyToken,
        integrationFound: !!integration,
        dbError: dbError?.message
      });

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('Webhook verified successfully');
        return new Response(challenge, { 
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
        });
      } else {
        console.log('Webhook verification failed:', {
          mode,
          token,
          verifyToken,
          integration: integration?.config
        });
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }
    }

    // Handle webhook events (POST request)
    if (req.method === 'POST') {
      const body: WebhookMessage = await req.json();
      
      console.log('Received webhook:', JSON.stringify(body, null, 2));

      // Log webhook
      await supabase.from('webhook_logs').insert({
        source: 'meta_whatsapp',
        method: 'POST',
        url: req.url,
        headers: Object.fromEntries(req.headers.entries()),
        body: body,
        response_status: 200
      });

      // Process each entry
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const processResult = await processMessages(supabase, change.value);
            
            // Se a mensagem foi salva com sucesso, processar com Dify
            if (processResult?.conversation_id && processResult?.content) {
              try {
                await supabase.functions.invoke('dify-process-messages', {
                  body: {
                    conversationId: processResult.conversation_id,
                    phoneNumber: processResult.phone_number,
                    messageContent: processResult.content
                  }
                });
              } catch (error) {
                console.error('Error invoking Dify processing:', error);
              }
            }
          }
        }
      }

      return new Response('OK', { headers: corsHeaders });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('Error in whatsapp-webhook:', error);
    
    // Log error
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'whatsapp-webhook',
      message: error.message,
      details: { error: error.toString(), stack: error.stack }
    });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processMessages(supabase: any, value: any) {
  const { messages, contacts, metadata } = value;
  
  if (!messages) return null;

  for (const message of messages) {
    const phoneNumber = message.from;
    const messageId = message.id;
    const timestamp = message.timestamp;
    
    // Get contact name
    const contact = contacts?.find((c: any) => c.wa_id === phoneNumber);
    const customerName = contact?.profile?.name || 'Cliente WhatsApp';

    // Find or create conversation
    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (!conversation) {
      const { data: newConversation } = await supabase
        .from('conversations')
        .insert({
          phone_number: phoneNumber,
          customer_name: customerName,
          status: 'bot_attending'
        })
        .select()
        .single();
      
      conversation = newConversation;
    }

    if (!conversation) {
      console.error('Failed to create or find conversation');
      return null;
    }

    // Process message content
    let content = '';
    let messageType = 'text';
    let mediaUrl = null;

    switch (message.type) {
      case 'text':
        content = message.text?.body || '';
        break;
      case 'audio':
        messageType = 'audio';
        mediaUrl = message.audio?.id;
        content = '[Áudio]';
        break;
      case 'document':
        messageType = 'document';
        mediaUrl = message.document?.id;
        content = `[Documento: ${message.document?.filename || 'arquivo'}]`;
        break;
      case 'image':
        messageType = 'image';
        mediaUrl = message.image?.id;
        content = '[Imagem]';
        break;
      case 'video':
        messageType = 'video';
        mediaUrl = message.video?.id;
        content = '[Vídeo]';
        break;
      case 'voice':
        messageType = 'voice';
        mediaUrl = message.voice?.id;
        content = '[Mensagem de voz]';
        break;
      case 'location':
        messageType = 'location';
        content = `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`;
        break;
      default:
        content = `[Mensagem não suportada: ${message.type}]`;
    }

    // Save message
    const { data: savedMessage } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      whatsapp_message_id: messageId,
      sender_type: 'customer',
      sender_name: customerName,
      content: content,
      message_type: messageType,
      media_url: mediaUrl,
      metadata: { original_message: message }
    }).select().single();

    // Process media in background if exists
    if (mediaUrl && savedMessage) {
      // Use EdgeRuntime.waitUntil to process media without blocking response
      EdgeRuntime.waitUntil(processMediaInBackground(supabase, {
        mediaId: mediaUrl,
        conversationId: conversation.id,
        messageId: savedMessage.id,
        messageType: messageType
      }));
    }

    // Add to message queue for batching only if not in fallback mode and bot is attending
    if (!conversation.fallback_mode && conversation.status === 'bot_attending') {
      await supabase.from('message_queue').insert({
        conversation_id: conversation.id,
        messages_content: [content],
        status: 'waiting'
      });
    } else {
      console.log(`Skipping queue insertion for conversation ${conversation.id} - fallback_mode: ${conversation.fallback_mode}, status: ${conversation.status}`);
    }

    console.log(`Message processed for conversation ${conversation.id}`);
    
    // Return data for Dify processing
    return {
      conversation_id: conversation.id,
      phone_number: phoneNumber,
      content: content,
      message_type: messageType
    };
  }
  
  return null;
}

async function processMediaInBackground(supabase: any, params: {
  mediaId: string;
  conversationId: string;
  messageId: string;
  messageType: string;
}) {
  try {
    console.log(`Processando mídia em background: ${params.mediaId}`);

    // Call the media processor function
    const { data, error } = await supabase.functions.invoke('whatsapp-media-processor', {
      body: {
        mediaId: params.mediaId,
        conversationId: params.conversationId,
        messageType: params.messageType
      }
    });

    if (error) {
      throw error;
    }

    if (data?.success && data?.publicUrl) {
      // Update message with the processed media URL
      await supabase
        .from('messages')
        .update({ 
          media_url: data.publicUrl,
          metadata: { 
            original_media_id: params.mediaId,
            file_name: data.fileName,
            mime_type: data.mimeType,
            file_size: data.fileSize,
            processed_at: new Date().toISOString()
          }
        })
        .eq('id', params.messageId);

      console.log(`Mídia processada com sucesso: ${data.publicUrl}`);
    }

  } catch (error) {
    console.error('Erro ao processar mídia em background:', error);
    
    // Log the error and mark media as failed
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'whatsapp-webhook-media-processing',
      message: `Falha ao processar mídia ${params.mediaId}`,
      details: {
        error: error.message,
        media_id: params.mediaId,
        conversation_id: params.conversationId,
        message_id: params.messageId
      }
    });

    // Update message to indicate processing failed
    await supabase
      .from('messages')
      .update({ 
        metadata: { 
          original_media_id: params.mediaId,
          processing_failed: true,
          error: error.message,
          failed_at: new Date().toISOString()
        }
      })
      .eq('id', params.messageId);
  }
}