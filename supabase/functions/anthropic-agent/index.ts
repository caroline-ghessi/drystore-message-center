
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

    console.log(`Claude Agent called for: ${agentKey}`);

    if (!agentKey) {
      console.error('AgentKey is required but was not provided');
      throw new Error('AgentKey is required');
    }

    // Buscar configuração do agente
    const { data: settings, error: settingsError } = await supabaseClient
      .from('settings')
      .select('*')
      .eq('key', agentKey)
      .single();

    if (settingsError || !settings) {
      console.error(`Agent configuration not found for key: ${agentKey}`, settingsError);
      
      // Se não encontrar configuração específica, usar configuração padrão para resumos
      if (agentKey === 'ai_agent_summary_generator_prompt') {
        console.log('Using default summary generator configuration');
        const defaultConfig = {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          temperature: 0.3,
          system_prompt: 'Você é um assistente especializado em gerar resumos profissionais de conversas de atendimento ao cliente. Analise a conversa e crie um resumo claro, objetivo e útil para o vendedor dar continuidade ao atendimento.'
        };
        
        // Preparar mensagens para Claude
        const claudeMessages = [
          {
            role: 'user',
            content: defaultConfig.system_prompt + '\n\nContext: ' + JSON.stringify(context) + '\n\nUser query: ' + messages[messages.length - 1].content
          }
        ];

        // Chamar API da Anthropic
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: defaultConfig.model,
            max_tokens: defaultConfig.max_tokens,
            temperature: defaultConfig.temperature,
            messages: claudeMessages,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Anthropic API error:', error);
          throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        const result = data.content[0].text;

        return new Response(JSON.stringify({ 
          result,
          usage: data.usage,
          agentKey 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        throw new Error(`Agent configuration not found: ${agentKey}`);
      }
    }

    const agentConfig = settings.value as any;
    
    // Preparar mensagens para Claude
    const claudeMessages = [
      {
        role: 'user',
        content: agentConfig.system_prompt + '\n\nContext: ' + JSON.stringify(context) + '\n\nUser query: ' + messages[messages.length - 1].content
      }
    ];

    // Chamar API da Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: agentConfig.model || 'claude-3-5-sonnet-20241022',
        max_tokens: agentConfig.max_tokens || 1000,
        temperature: agentConfig.temperature || 0.7,
        messages: claudeMessages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.content[0].text;

    // Log da atividade
    await supabaseClient
      .from('system_logs')
      .insert({
        type: 'info',
        source: 'anthropic-agent',
        message: `Agent ${agentKey} executed successfully`,
        details: {
          agentKey,
          model: agentConfig?.model || 'claude-3-5-sonnet-20241022',
          tokensUsed: data.usage?.output_tokens || 0,
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
    console.error('Error in anthropic-agent:', error);

    // Log do erro
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseClient
      .from('system_logs')
      .insert({
        type: 'error',
        source: 'anthropic-agent',
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
