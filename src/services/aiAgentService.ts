import { supabase } from '@/integrations/supabase/client';

export interface AIAgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIAgentResponse {
  result: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  agentKey: string;
}

export class AIAgentService {
  private static instance: AIAgentService;

  private constructor() {}

  public static getInstance(): AIAgentService {
    if (!AIAgentService.instance) {
      AIAgentService.instance = new AIAgentService();
    }
    return AIAgentService.instance;
  }

  /**
   * Executa um agente de IA baseado no tipo de modelo
   */
  async executeAgent(
    agentKey: string,
    messages: AIAgentMessage[],
    context?: Record<string, any>
  ): Promise<AIAgentResponse> {
    try {
      // Determinar qual função usar baseado no modelo do agente
      const { data: agentConfig, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', agentKey)
        .single();

      if (error) {
        throw new Error(`Agent configuration not found: ${agentKey}`);
      }

      const config = agentConfig.value as any;
      const model = config.model || 'claude-3-5-sonnet-20241022';

      // Decidir qual edge function usar baseado no modelo
      const functionName = this.getFunctionNameForModel(model);

      // Chamar a edge function apropriada
      const { data, error: functionError } = await supabase.functions.invoke(functionName, {
        body: {
          agentKey,
          messages,
          context
        }
      });

      if (functionError) {
        throw new Error(`Function execution error: ${functionError.message}`);
      }

      return data as AIAgentResponse;
    } catch (error) {
      console.error('Error executing agent:', error);
      throw error;
    }
  }

  /**
   * Determina qual edge function usar baseado no modelo
   */
  private getFunctionNameForModel(model: string): string {
    if (model.startsWith('claude-')) {
      return 'anthropic-agent';
    } else if (model.startsWith('grok-')) {
      return 'grok-agent';
    } else {
      // Default para Claude
      return 'anthropic-agent';
    }
  }

  /**
   * Métodos específicos para cada tipo de agente
   */

  // Avaliador de Leads
  async evaluateLead(
    customerName: string,
    phoneNumber: string,
    messages: string[],
    customerInfo?: Record<string, any>
  ): Promise<{
    qualification: 'high' | 'medium' | 'low';
    productInterest: string;
    summary: string;
    suggestedSeller?: string;
  }> {
    const context = {
      customerName,
      phoneNumber,
      messages,
      customerInfo
    };

    const response = await this.executeAgent(
      'ai_agent_lead_evaluator_prompt',
      [{ role: 'user', content: `Avalie este lead: ${JSON.stringify(context)}` }],
      context
    );

    try {
      return JSON.parse(response.result);
    } catch {
      // Fallback se não conseguir parsear como JSON
      return {
        qualification: 'medium',
        productInterest: 'Não especificado',
        summary: response.result,
      };
    }
  }

  // Matcher de Vendedores
  async matchSeller(
    leadInfo: {
      qualification: string;
      productInterest: string;
      location?: string;
      budget?: string;
    },
    availableSellers: Array<{
      id: string;
      name: string;
      specialties?: string[];
      activeLeads: number;
    }>
  ): Promise<{
    sellerId: string;
    matchReason: string;
    confidence: number;
  }> {
    const context = {
      lead: leadInfo,
      sellers: availableSellers
    };

    const response = await this.executeAgent(
      'ai_agent_seller_matcher_prompt',
      [{ role: 'user', content: `Faça o match do lead com o melhor vendedor: ${JSON.stringify(context)}` }],
      context
    );

    try {
      return JSON.parse(response.result);
    } catch {
      // Fallback para o primeiro vendedor disponível
      const firstSeller = availableSellers[0];
      return {
        sellerId: firstSeller?.id || '',
        matchReason: 'Match automático (fallback)',
        confidence: 0.5
      };
    }
  }

  // Gerador de Resumos
  async generateSummary(
    conversationMessages: Array<{
      content: string;
      sender_type: string;
      created_at: string;
    }>,
    customerInfo: {
      name: string;
      phone: string;
      productInterest?: string;
    }
  ): Promise<string> {
    const context = {
      messages: conversationMessages,
      customer: customerInfo
    };

    const response = await this.executeAgent(
      'ai_agent_summary_generator_prompt',
      [{ role: 'user', content: `Gere um resumo desta conversa: ${JSON.stringify(context)}` }],
      context
    );

    return response.result;
  }

  // Gerador de Primeira Mensagem
  async generateFirstMessage(
    customerName: string,
    sellerName: string,
    leadSummary: string,
    productInterest: string
  ): Promise<string> {
    const context = {
      customerName,
      sellerName,
      leadSummary,
      productInterest
    };

    const response = await this.executeAgent(
      'ai_agent_first_message_generator_prompt',
      [{ 
        role: 'user', 
        content: `Gere a primeira mensagem do vendedor ${sellerName} para o cliente ${customerName} baseado no resumo: ${leadSummary}. Produto de interesse: ${productInterest}` 
      }],
      context
    );

    return response.result;
  }

  // Analisador de Qualidade
  async analyzeQuality(
    conversationMessages: Array<{
      content: string;
      sender_type: string;
      created_at: string;
    }>,
    sellerId: string
  ): Promise<{
    score: number;
    feedback: string;
    suggestions: string[];
    categories: {
      responsiveness: number;
      professionalism: number;
      product_knowledge: number;
      closing_ability: number;
    };
  }> {
    const context = {
      messages: conversationMessages,
      sellerId
    };

    const response = await this.executeAgent(
      'ai_agent_quality_analyzer_prompt',
      [{ role: 'user', content: `Analise a qualidade do atendimento: ${JSON.stringify(context)}` }],
      context
    );

    try {
      return JSON.parse(response.result);
    } catch {
      // Fallback com dados básicos
      return {
        score: 7.0,
        feedback: response.result,
        suggestions: ['Manter o bom atendimento'],
        categories: {
          responsiveness: 7.0,
          professionalism: 7.0,
          product_knowledge: 7.0,
          closing_ability: 7.0
        }
      };
    }
  }

  // Assistente Estratégico (Visão do Dono)
  async getOwnerInsights(
    query: string,
    dashboardData?: Record<string, any>
  ): Promise<string> {
    const context = {
      query,
      dashboardData
    };

    const response = await this.executeAgent(
      'ai_agent_owner_insights_prompt',
      [{ role: 'user', content: query }],
      context
    );

    return response.result;
  }

  /**
   * Método para testar um agente específico
   */
  async testAgent(agentKey: string, testPrompt: string): Promise<AIAgentResponse> {
    return this.executeAgent(
      agentKey,
      [{ role: 'user', content: testPrompt }],
      { test: true, timestamp: new Date().toISOString() }
    );
  }
}

// Export da instância singleton
export const aiAgent = AIAgentService.getInstance();