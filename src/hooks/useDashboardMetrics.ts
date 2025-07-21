
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardMetrics {
  messagesToday: number;
  activeConversations: number;
  leadsGenerated: number;
  conversionRate: string;
}

export const useDashboardMetrics = () => {
  return useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async (): Promise<DashboardMetrics> => {
      const today = new Date().toISOString().split('T')[0];
      
      // Buscar mensagens de hoje
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .gte('created_at', today);

      // Buscar conversas ativas (não finalizadas)
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .neq('status', 'finished');

      // Buscar leads criados hoje
      const { data: leads } = await supabase
        .from('leads')
        .select('id')
        .gte('created_at', today);

      // Buscar total de conversas hoje para calcular taxa de conversão
      const { data: conversationsToday } = await supabase
        .from('conversations')
        .select('id')
        .gte('created_at', today);

      const messagesToday = messages?.length || 0;
      const activeConversations = conversations?.length || 0;
      const leadsGenerated = leads?.length || 0;
      const totalConversations = conversationsToday?.length || 0;
      
      const conversionRate = totalConversations > 0 
        ? Math.round((leadsGenerated / totalConversations) * 100) 
        : 0;

      return {
        messagesToday,
        activeConversations,
        leadsGenerated,
        conversionRate: `${conversionRate}%`
      };
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
};
