
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SellerPerformance {
  name: string;
  leads: number;
  conversions: number;
  rate: string;
}

export const useSellerPerformance = () => {
  return useQuery({
    queryKey: ['seller-performance'],
    queryFn: async (): Promise<SellerPerformance[]> => {
      const { data: sellers } = await supabase
        .from('sellers')
        .select(`
          id,
          name,
          leads (
            id,
            generated_sale
          )
        `)
        .eq('active', true);

      if (!sellers) return [];

      return sellers
        .map(seller => {
          const leads = seller.leads || [];
          const conversions = leads.filter(lead => lead.generated_sale).length;
          const rate = leads.length > 0 ? Math.round((conversions / leads.length) * 100) : 0;

          return {
            name: seller.name,
            leads: leads.length,
            conversions,
            rate: `${rate}%`
          };
        })
        .filter(seller => seller.leads > 0) // Mostrar apenas vendedores com leads
        .sort((a, b) => parseInt(b.rate) - parseInt(a.rate)); // Ordenar por taxa de conversão
    },
    refetchInterval: 60000, // Atualizar a cada minuto
  });
};
