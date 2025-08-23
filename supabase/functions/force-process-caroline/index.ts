import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 Forçando reprocessamento da mensagem da Caroline...');

    // Buscar conversa da Caroline
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', '555181223033')
      .eq('customer_name', 'Caroline Ghessi')
      .single();

    if (convError || !conversation) {
      throw new Error(`Conversa da Caroline não encontrada: ${convError?.message}`);
    }

    console.log(`📋 Conversa da Caroline encontrada: ${conversation.id}`);

    // Buscar a última mensagem do bot que foi salva mas não enviada
    const { data: botMessage, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .eq('sender_type', 'bot')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (msgError || !botMessage) {
      throw new Error(`Mensagem do bot não encontrada: ${msgError?.message}`);
    }

    console.log(`💬 Mensagem do bot encontrada: "${botMessage.content.substring(0, 100)}..."`);

    // Tentar enviar a mensagem via WhatsApp
    console.log(`📱 Enviando mensagem para WhatsApp da Caroline...`);
    
    const { data: whatsappData, error: whatsappError } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        to: conversation.phone_number,
        content: botMessage.content,
        type: 'text',
        conversationId: conversation.id
      }
    });

    if (whatsappError) {
      console.error(`❌ Erro ao enviar via WhatsApp:`, whatsappError);
      throw new Error(`WhatsApp send error: ${whatsappError.message || JSON.stringify(whatsappError)}`);
    }

    if (!whatsappData?.success) {
      throw new Error(`WhatsApp send failed: ${whatsappData?.error || 'Unknown error'}`);
    }

    console.log(`✅ Mensagem enviada com sucesso para Caroline!`);
    console.log(`📱 Message ID: ${whatsappData.message_id}`);

    // Atualizar status da mensagem no banco
    await supabase
      .from('messages')
      .update({
        metadata: {
          ...botMessage.metadata,
          whatsapp_sent: true,
          whatsapp_message_id: whatsappData.message_id,
          forced_reprocessing: true,
          reprocessed_at: new Date().toISOString()
        }
      })
      .eq('id', botMessage.id);

    // Log de sucesso
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'force_caroline_processing',
      message: '✅ Mensagem da Caroline reenviada com sucesso',
      details: {
        conversation_id: conversation.id,
        phone_number: conversation.phone_number,
        customer_name: conversation.customer_name,
        message_id: botMessage.id,
        whatsapp_message_id: whatsappData.message_id,
        bot_response: botMessage.content.substring(0, 200)
      }
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Mensagem da Caroline reenviada com sucesso',
      details: {
        conversation_id: conversation.id,
        phone_number: conversation.phone_number,
        whatsapp_message_id: whatsappData.message_id,
        bot_response: botMessage.content
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro ao forçar processamento da Caroline:', error);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log de erro
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'force_caroline_processing',
      message: '❌ Erro ao forçar reprocessamento da Caroline',
      details: {
        error: error.message,
        stack: error.stack
      }
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});