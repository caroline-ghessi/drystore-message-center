import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Testando conexão com Dify API...');

    // Verifica se a secret existe
    const apiKey = Deno.env.get('DIFY_API_KEY');
    console.log('🔑 DIFY_API_KEY exists:', !!apiKey);
    console.log('🔑 DIFY_API_KEY length:', apiKey?.length || 0);
    
    if (!apiKey) {
      throw new Error('DIFY_API_KEY not found in secrets');
    }

    // Testa conexão com Dify
    const testPayload = {
      inputs: {},
      query: "teste de conexão",
      response_mode: 'blocking',
      user: 'test-user-555181223033',
    };

    console.log('📤 Enviando payload para Dify:', JSON.stringify(testPayload, null, 2));

    const response = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log('📥 Resposta do Dify:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro detalhado do Dify:', errorText);
      
      return new Response(JSON.stringify({ 
        success: false,
        error: `Dify API error: ${response.status} ${response.statusText}`,
        details: errorText,
        api_key_present: !!apiKey,
        api_key_length: apiKey?.length || 0
      }), {
        status: 200, // Não retornar erro HTTP para podermos ver a resposta
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const difyResponse = await response.json();
    console.log('✅ Resposta do Dify:', JSON.stringify(difyResponse, null, 2));

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Dify connection successful',
      dify_response: difyResponse,
      api_key_present: !!apiKey,
      api_key_length: apiKey?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no teste de conexão:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});