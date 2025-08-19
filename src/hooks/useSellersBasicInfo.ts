import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SellerBasicInfo {
  id: string;
  name: string;
  active: boolean;
  personality_type: string;
  experience_years: number;
  performance_score: number;
  conversion_rate: number;
  current_workload: number;
  max_concurrent_leads: number;
  created_at: string;
}

/**
 * Hook for operators to access basic seller information without sensitive data
 * This uses the secure sellers_basic_info view that excludes phone numbers, emails, and API tokens
 */
export const useSellersBasicInfo = () => {
  return useQuery({
    queryKey: ['sellers-basic-info'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellers_basic_info')
        .select('*')
        .order('name');

      if (error) {
        console.error('Erro ao buscar informações básicas dos vendedores:', error);
        throw error;
      }

      return (data || []) as SellerBasicInfo[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};