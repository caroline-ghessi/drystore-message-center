import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AutomationMetrics {
  conversationsProcessed: number;
  qualificationRate: number;
  leadsGenerated: number;
  avgProcessingTime: number;
  automationActive: boolean;
  pendingEvaluations: number;
  failedEvaluations: number;
  successfulTransfers: number;
}

export interface AutomationActivity {
  id: string;
  customer_name: string;
  phone_number: string;
  status: string;
  created_at: string;
  seller_name?: string;
  evaluation_result?: string;
}

export interface SellerAutomationStats {
  seller_id: string;
  seller_name: string;
  auto_leads_received: number;
  manual_leads_received: number;
  auto_conversion_rate: number;
  manual_conversion_rate: number;
  avg_response_time: number;
  current_workload: number;
}

export const useAutomationMetrics = () => {
  return useQuery({
    queryKey: ['automation-metrics'],
    queryFn: async (): Promise<AutomationMetrics> => {
      const today = new Date().toISOString().split('T')[0];
      
      // Buscar conversas processadas hoje
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, status, created_at')
        .gte('created_at', today);

      // Buscar leads gerados automaticamente hoje
      const { data: leads } = await supabase
        .from('leads')
        .select('id, created_at')
        .gte('created_at', today);

      // Buscar logs do sistema para métricas
      const { data: logs } = await supabase
        .from('system_logs')
        .select('*')
        .eq('source', 'automation')
        .gte('created_at', today);

      const conversationsProcessed = conversations?.length || 0;
      const leadsGenerated = leads?.length || 0;
      const qualificationRate = conversationsProcessed > 0 ? (leadsGenerated / conversationsProcessed) * 100 : 0;
      
      const pendingEvaluations = conversations?.filter(c => c.status === 'waiting_evaluation').length || 0;
      const successfulTransfers = conversations?.filter(c => c.status === 'sent_to_seller').length || 0;
      
      const failedLogs = logs?.filter(log => log.type === 'error').length || 0;

      return {
        conversationsProcessed,
        qualificationRate: Math.round(qualificationRate),
        leadsGenerated,
        avgProcessingTime: 3.2, // Mock - calcular real baseado nos logs
        automationActive: true, // Verificar status real
        pendingEvaluations,
        failedEvaluations: failedLogs,
        successfulTransfers
      };
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
};

export const useAutomationActivity = () => {
  return useQuery({
    queryKey: ['automation-activity'],
    queryFn: async (): Promise<AutomationActivity[]> => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          customer_name,
          phone_number,
          status,
          created_at,
          sellers (name)
        `)
        .in('status', ['waiting_evaluation', 'sent_to_seller', 'finished'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        customer_name: item.customer_name || 'Cliente',
        phone_number: item.phone_number,
        status: item.status,
        created_at: item.created_at,
        seller_name: item.sellers?.name,
      }));
    },
    refetchInterval: 10000, // Atualizar a cada 10 segundos
  });
};

export const useSellerAutomationStats = () => {
  return useQuery({
    queryKey: ['seller-automation-stats'],
    queryFn: async (): Promise<SellerAutomationStats[]> => {
      const { data: sellers } = await supabase
        .from('sellers')
        .select('id, name, current_workload')
        .eq('active', true);

      const { data: leads } = await supabase
        .from('leads')
        .select('seller_id, generated_sale')
        .not('seller_id', 'is', null);

      // Simular dados de automação vs manual
      return (sellers || []).map(seller => {
        const sellerLeads = leads?.filter(l => l.seller_id === seller.id) || [];
        const conversions = sellerLeads.filter(l => l.generated_sale).length;
        
        return {
          seller_id: seller.id,
          seller_name: seller.name,
          auto_leads_received: Math.floor(sellerLeads.length * 0.6), // 60% automático
          manual_leads_received: Math.floor(sellerLeads.length * 0.4), // 40% manual
          auto_conversion_rate: sellerLeads.length > 0 ? Math.round((conversions / sellerLeads.length) * 100) : 0,
          manual_conversion_rate: sellerLeads.length > 0 ? Math.round((conversions / sellerLeads.length) * 0.8 * 100) : 0,
          avg_response_time: Math.floor(Math.random() * 10) + 5, // Mock: 5-15 min
          current_workload: seller.current_workload || 0,
        };
      });
    },
    refetchInterval: 60000, // Atualizar a cada minuto
  });
};