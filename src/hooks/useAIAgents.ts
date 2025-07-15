import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AIAgentConfig {
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

export const useAIAgents = () => {
  const [agents, setAgents] = useState<Record<string, AIAgentConfig>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .like('key', 'ai_agent_%_prompt');

      if (error) throw error;

      const agentsMap: Record<string, AIAgentConfig> = {};
      data?.forEach(setting => {
        agentsMap[setting.key] = setting.value as unknown as AIAgentConfig;
      });

      setAgents(agentsMap);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAgent = (key: string): AIAgentConfig | null => {
    return agents[key] || null;
  };

  const getOwnerInsightsPrompt = (): string => {
    const agent = getAgent('ai_agent_owner_insights_prompt');
    return agent?.system_prompt || 'Você é um assistente estratégico especializado em análise de vendas e leads.';
  };

  return {
    agents,
    loading,
    getAgent,
    getOwnerInsightsPrompt,
    refreshAgents: loadAgents
  };
};