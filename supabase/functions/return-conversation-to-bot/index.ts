import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { conversation_id } = await req.json();
    
    if (!conversation_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'conversation_id is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify conversation exists and is in fallback mode
    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select('id, customer_name, phone_number, fallback_mode, status')
      .eq('id', conversation_id)
      .single();

    if (fetchError || !conversation) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Conversation not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!conversation.fallback_mode && conversation.status === 'bot_attending') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Conversation is already being handled by bot'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Return conversation to bot
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        status: 'bot_attending',
        fallback_mode: false,
        fallback_taken_by: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation_id);

    if (updateError) {
      console.error('Error updating conversation:', updateError);
      throw updateError;
    }

    // Log the action
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'dify',
      message: 'Conversa devolvida ao bot',
      details: {
        conversation_id: conversation_id,
        customer_name: conversation.customer_name,
        phone_number: conversation.phone_number,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`Conversation ${conversation_id} returned to bot successfully`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Conversa devolvida ao bot com sucesso',
      conversation: {
        id: conversation_id,
        customer_name: conversation.customer_name,
        status: 'bot_attending',
        fallback_mode: false
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in return-conversation-to-bot:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});