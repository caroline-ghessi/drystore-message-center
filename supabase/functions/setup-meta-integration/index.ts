
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

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('Setting up Meta WhatsApp integration...');

    // Get secrets from environment
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const businessAccountId = Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID');
    const appId = Deno.env.get('META_APP_ID');

    if (!metaAccessToken || !phoneNumberId || !businessAccountId || !appId) {
      throw new Error('Missing required Meta configuration');
    }

    // Configuration for Meta WhatsApp Business API
    const config = {
      meta_access_token: metaAccessToken,
      phone_number_id: phoneNumberId,
      business_account_id: businessAccountId,
      app_id: appId,
      webhook_verify_token: 'whatsapp_meta_verify_mTk9Xx2A',
      webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`
    };

    // Insert or update integration
    const { data: existingIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('type', 'meta')
      .eq('name', 'WhatsApp Business Meta')
      .single();

    if (existingIntegration) {
      // Update existing integration
      const { error } = await supabase
        .from('integrations')
        .update({
          config: config,
          active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingIntegration.id);

      if (error) throw error;
      console.log('Updated existing Meta integration');
    } else {
      // Create new integration
      const { error } = await supabase
        .from('integrations')
        .insert({
          type: 'meta',
          name: 'WhatsApp Business Meta',
          config: config,
          active: true
        });

      if (error) throw error;
      console.log('Created new Meta integration');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Meta WhatsApp integration configured successfully',
      config: {
        phone_number_id: phoneNumberId,
        business_account_id: businessAccountId,
        app_id: appId,
        webhook_url: config.webhook_url
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error setting up Meta integration:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
