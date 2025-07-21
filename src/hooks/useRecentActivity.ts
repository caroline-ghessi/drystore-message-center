
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface RecentActivity {
  id: string;
  customer: string;
  phone: string;
  action: string;
  time: string;
  status: string;
}

export const useRecentActivity = () => {
  return useQuery({
    queryKey: ['recent-activity'],
    queryFn: async (): Promise<RecentActivity[]> => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          customer_name,
          phone_number,
          status,
          updated_at,
          leads (
            seller_id,
            sellers (name)
          )
        `)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (data || []).map(item => {
        let action = 'Conversa iniciada';
        let status = 'active';

        switch (item.status) {
          case 'sent_to_seller':
            const sellerName = item.leads?.[0]?.sellers?.name;
            action = sellerName ? `Enviado ao vendedor ${sellerName}` : 'Enviado ao vendedor';
            status = 'sent_to_seller';
            break;
          case 'finished':
            action = 'Conversa finalizada';
            status = 'finished';
            break;
          case 'waiting_evaluation':
            action = 'Aguardando avaliação';
            status = 'waiting_evaluation';
            break;
          case 'bot_attending':
            action = 'Em atendimento pelo bot';
            status = 'bot_attending';
            break;
        }

        return {
          id: item.id,
          customer: item.customer_name || 'Cliente',
          phone: item.phone_number,
          action,
          time: formatDistanceToNow(new Date(item.updated_at), { 
            addSuffix: true, 
            locale: ptBR 
          }),
          status
        };
      });
    },
    refetchInterval: 10000, // Atualizar a cada 10 segundos
  });
};
