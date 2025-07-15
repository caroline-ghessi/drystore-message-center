import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgentRequest {
  agentKey: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  context?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { agentKey, messages, context = {} }: AgentRequest = await req.json();

    console.log(`Grok Agent called for: ${agentKey}`);

    // Buscar configuração do agente
    const { data: settings, error: settingsError } = await supabaseClient
      .from('settings')
      .select('*')
      .eq('key', agentKey)
      .single();

    if (settingsError) {
      throw new Error(`Agent configuration not found: ${agentKey}`);
    }

    const agentConfig = settings.value as any;
    
    // Preparar mensagens para Grok
    const grokMessages = [
      {
        role: 'system',
        content: agentConfig.system_prompt
      },
      {
        role: 'user', 
        content: `Context: ${JSON.stringify(context)}\n\n${messages[messages.length - 1].content}`
      }
    ];

    // Chamar API do Grok (xAI)
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('XAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: agentConfig.model || 'grok-beta',
        max_tokens: agentConfig.max_tokens || 1000,
        temperature: agentConfig.temperature || 0.7,
        messages: grokMessages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Grok API error:', error);
      throw new Error(`Grok API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    // Log da atividade
    await supabaseClient
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'grok-agent',
        message: `Agent ${agentKey} executed successfully`,
        details: {
          agentKey,
          model: agentConfig.model,
          tokensUsed: data.usage?.total_tokens || 0,
          context
        }
      });

    return new Response(JSON.stringify({ 
      result,
      usage: data.usage,
      agentKey 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in grok-agent:', error);

    // Log do erro
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseClient
      .from('system_logs')
      .insert({
        type: 'error',
        source: 'grok-agent',
        message: `Error: ${error.message}`,
        details: { error: error.message }
      });

    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});