
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  to: string;
  type: 'text' | 'template' | 'audio';
  content?: string; // Content opcional para text messages
  message?: string; // Alias para content (compatibilidade)
  template_name?: string;
  template_language?: string;
  template_components?: any[];
  audioBase64?: string; // Base64 do áudio para envio
  conversationId?: string; // ID da conversa para logs
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const request: SendMessageRequest = await req.json();
    const { to, type, template_name, template_language, template_components, audioBase64, conversationId } = request;
    
    // Normalizar content/message (compatibilidade com diferentes chamadas)
    const content = request.content || request.message;

    console.log('Sending WhatsApp message:', { to, type, content: content?.substring(0, 100), hasAudio: !!audioBase64 });

    // Validação básica
    if (!to || !to.trim()) {
      throw new Error('Recipient phone number is required');
    }

    if (type === 'text' && (!content || content.trim() === '')) {
      throw new Error('Content is required for text messages');
    }

    if (type === 'audio' && !audioBase64) {
      throw new Error('Audio data is required for audio messages');
    }

    // Get Meta WhatsApp configuration from environment (more secure)
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!accessToken || !phoneNumberId) {
      throw new Error('Meta Access Token or Phone Number ID not configured');
    }

    // Prepare message payload
    let messagePayload: any = {
      messaging_product: 'whatsapp',
      to: to,
    };

    if (type === 'template') {
      messagePayload.type = 'template';
      messagePayload.template = {
        name: template_name,
        language: {
          code: template_language || 'pt_BR'
        },
        components: template_components || []
      };
    } else if (type === 'audio' && audioBase64) {
      // Converter base64 para upload de mídia
      const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      
      // Upload do áudio para o WhatsApp primeiro
      const mediaFormData = new FormData();
      mediaFormData.append('file', audioBlob, 'audio.mp3');
      mediaFormData.append('type', 'audio/mpeg');
      mediaFormData.append('messaging_product', 'whatsapp');

      const uploadResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: mediaFormData,
      });

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.text();
        throw new Error(`Failed to upload audio: ${uploadResponse.status} - ${uploadError}`);
      }

      const uploadData = await uploadResponse.json();
      
      messagePayload.type = 'audio';
      messagePayload.audio = {
        id: uploadData.id
      };
    } else {
      messagePayload.type = 'text';
      messagePayload.text = {
        body: content
      };
    }

    // Send message via Meta Graph API
    const graphApiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    
    console.log('Sending to Graph API:', graphApiUrl);
    console.log('Payload:', JSON.stringify(messagePayload, null, 2));

    const response = await fetch(graphApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const responseData = await response.json();
    
    console.log('Graph API response:', response.status, responseData);

    // Log the API call in webhook_logs
    await supabase.from('webhook_logs').insert({
      source: 'whatsapp-send',
      method: 'POST',
      url: graphApiUrl,
      headers: { 'Authorization': 'Bearer [REDACTED]' },
      body: messagePayload,
      response_status: response.status,
      response_body: responseData
    });

    if (!response.ok) {
      throw new Error(`Meta Graph API error: ${response.status} - ${JSON.stringify(responseData)}`);
    }

    // Log success in system_logs
    await supabase.from('system_logs').insert({
      type: 'success',
      source: 'whatsapp-send',
      message: `WhatsApp message sent successfully to ${to}`,
      details: { 
        message_id: responseData.messages?.[0]?.id,
        to: to,
        type: type,
        response_status: response.status
      }
    });

    // If sending to a conversation, save the message
    if (responseData.messages?.[0]?.id) {
      let conversation = null;
      
      // Use conversationId if provided, otherwise lookup by phone
      if (conversationId) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', conversationId)
          .single();
        conversation = conv;
      } else {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('phone_number', to)
          .single();
        conversation = conv;
      }

      if (conversation) {
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          whatsapp_message_id: responseData.messages[0].id,
          sender_type: 'bot',
          sender_name: 'Sistema',
          content: content,
          message_type: type === 'template' ? 'template' : (type === 'audio' ? 'audio' : 'text'),
          metadata: { 
            template_name,
            graph_api_response: responseData,
            sent_as_audio: type === 'audio',
            elevenlabs_generated: !!audioBase64
          }
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: responseData.messages?.[0]?.id,
      response: responseData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in whatsapp-send:', error);
    
    // Log error
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'whatsapp-send',
      message: error.message,
      details: { error: error.toString(), stack: error.stack }
    });

    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
