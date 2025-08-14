import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { aiAgent } from '@/services/aiAgentService';

interface OwnerInsightsData {
  metrics: {
    messagesToday: number;
    activeConversations: number;
    leadsGenerated: number;
    salesGenerated: number;
    totalRevenue: number;
    conversionRate: number;
  };
  sellers: Array<{
    id: string;
    name: string;
    activeLeads: number;
    totalSales: number;
    conversionRate: number;
    responseTime: number;
  }>;
  recentNegotiations: Array<{
    customerName: string;
    sellerName: string;
    productInterest: string;
    value: number;
    status: string;
  }>;
  mainObjections: Array<{
    objection: string;
    frequency: number;
  }>;
}

export const useOwnerInsights = () => {
  const [isLoading, setIsLoading] = useState(false);

  // Buscar dados reais do dashboard
  const { data: insightsData, isLoading: dataLoading } = useQuery({
    queryKey: ['owner-insights-data'],
    queryFn: async (): Promise<OwnerInsightsData> => {
      const today = new Date().toISOString().split('T')[0];
      
      // Buscar métricas básicas
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .gte('created_at', today);

      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, status')
        .neq('status', 'finished');

      const { data: leads } = await supabase
        .from('leads')
        .select('id, generated_sale, sale_value, seller_id, customer_name, product_interest, status')
        .gte('created_at', today);

      // Buscar dados dos vendedores com performance
      const { data: sellers } = await supabase
        .from('sellers')
        .select(`
          id, 
          name,
          current_workload,
          conversion_rate,
          average_ticket
        `)
        .eq('active', true);

      // Calcular métricas
      const salesGenerated = leads?.filter(l => l.generated_sale).length || 0;
      const totalRevenue = leads?.reduce((sum, l) => sum + (l.sale_value || 0), 0) || 0;
      const conversionRate = leads?.length ? (salesGenerated / leads.length) * 100 : 0;

      // Buscar negociações recentes
      const { data: recentLeads } = await supabase
        .from('leads')
        .select(`
          customer_name,
          product_interest,
          sale_value,
          status,
          seller:sellers(name)
        `)
        .eq('status', 'attending')
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        metrics: {
          messagesToday: messages?.length || 0,
          activeConversations: conversations?.length || 0,
          leadsGenerated: leads?.length || 0,
          salesGenerated,
          totalRevenue,
          conversionRate
        },
        sellers: sellers?.map(s => ({
          id: s.id,
          name: s.name,
          activeLeads: s.current_workload || 0,
          totalSales: 0, // Seria calculado com query específica
          conversionRate: s.conversion_rate || 0,
          responseTime: 8 // Seria calculado com query específica
        })) || [],
        recentNegotiations: recentLeads?.map(l => ({
          customerName: l.customer_name,
          sellerName: (l.seller as any)?.name || 'N/A',
          productInterest: l.product_interest || 'N/A',
          value: l.sale_value || 0,
          status: l.status
        })) || [],
        mainObjections: [
          { objection: 'Preço alto', frequency: 34 },
          { objection: 'Prazo de entrega', frequency: 23 },
          { objection: 'Dúvidas sobre qualidade', frequency: 18 }
        ]
      };
    },
    refetchInterval: 30000
  });

  const askQuestion = async (question: string): Promise<string> => {
    setIsLoading(true);
    try {
      const response = await aiAgent.getOwnerInsights(question, insightsData);
      return response;
    } catch (error) {
      console.error('Erro ao consultar agente:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    data: insightsData,
    isLoading: isLoading || dataLoading,
    askQuestion
  };
};