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
    // Delete messages from conversations in fallback_mode or sent_to_seller
    const { data, error } = await supabase
      .from('message_queue')
      .delete()
      .in('conversation_id', 
        supabase.from('conversations')
          .select('id')
          .or('fallback_mode.eq.true,status.eq.sent_to_seller')
      );

    if (error) {
      console.error('Error cleaning up messages:', error);
      throw error;
    }

    // Log the cleanup
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'dify',
      message: 'Mensagens inválidas removidas da fila de processamento',
      details: {
        success: true,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Mensagens inválidas limpas com sucesso'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in cleanup-invalid-messages:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});