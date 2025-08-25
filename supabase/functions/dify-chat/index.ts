import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DifyMessage {
  inputs: Record<string, any>;
  query: string;
  response_mode: 'blocking' | 'streaming';
  conversation_id?: string;
  user: string;
  files?: Array<{
    type: string;
    transfer_method: string;
    url?: string;
    upload_file_id?: string;
  }>;
}

interface DifyResponse {
  message_id: string;
  conversation_id: string;
  mode: string;
  answer: string;
  metadata: {
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    retriever_resources?: Array<any>;
  };
  created_at: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { message, conversationId, userId, files, hasFiles } = await req.json();

    // Busca configuração do Dify usando função segura
    const { data: integrationData, error: integrationError } = await supabase
      .rpc('get_integration_config_secure', { integration_type_param: 'dify' });

    if (integrationError || !integrationData || integrationData.length === 0) {
      console.error('Erro ao buscar configuração Dify:', integrationError);
      throw new Error('Dify integration not configured or accessible');
    }

    const integration = integrationData[0];
    if (!integration?.config) {
      throw new Error('Dify integration not configured');
    }

    const config = integration.config as { api_url: string };
    const apiKey = Deno.env.get('DIFY_API_KEY');
    
    if (!apiKey) {
      throw new Error('DIFY_API_KEY not found in secrets');
    }

    // Prepara payload para Dify
    const payload: DifyMessage = {
      inputs: {},
      query: message,
      response_mode: 'blocking',
      user: userId || 'default-user',
    };

    // Adicionar arquivos se houver
    if (hasFiles && files && files.length > 0) {
      payload.inputs.arquivo = files; // Usando a variável 'arquivo' configurada no Dify
      console.log('Enviando arquivos para Dify:', files);
    }

    if (conversationId) {
      payload.conversation_id = conversationId;
    }

    // Envia para Dify
    const response = await fetch(`${config.api_url}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dify API error: ${response.statusText} - ${errorText}`);
    }

    const difyResponse: DifyResponse = await response.json();

    // Log de sucesso
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'dify-chat',
      message: 'Mensagem enviada com sucesso via edge function',
      details: {
        message_id: difyResponse.message_id,
        conversation_id: difyResponse.conversation_id,
        tokens_used: difyResponse.metadata.usage.total_tokens,
        user_id: userId
      }
    });

    return new Response(JSON.stringify(difyResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in dify-chat:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});