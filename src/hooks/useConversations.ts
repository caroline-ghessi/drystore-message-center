import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface Conversation {
  id: string;
  phone_number: string;
  customer_name: string;
  status: 'bot_attending' | 'waiting_evaluation' | 'sent_to_seller' | 'finished' | 'fallback_active';
  last_message: string;
  last_message_at: string;
  unread_count?: number;
  fallback_mode: boolean;
  fallback_taken_by?: string;
  assigned_seller_id?: string;
  seller_name?: string;
  total_messages: number;
  created_at: string;
  updated_at: string;
}

export const useConversations = (searchTerm?: string) => {
  const query = useQuery({
    queryKey: ['conversations', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('conversations_with_last_message')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`customer_name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar conversas:', error);
        throw error;
      }

      return (data || []).map(conv => ({
        id: conv.id,
        phone_number: conv.phone_number || '',
        customer_name: conv.customer_name || 'Cliente',
        status: conv.status || 'bot_attending',
        last_message: conv.last_message || '',
        last_message_at: conv.last_message_at || new Date().toISOString(),
        unread_count: 0, // TODO: calcular mensagens não lidas
        fallback_mode: conv.fallback_mode || false,
        fallback_taken_by: conv.fallback_taken_by,
        assigned_seller_id: conv.assigned_seller_id,
        seller_name: conv.seller_name,
        total_messages: conv.total_messages || 0,
        created_at: conv.created_at || new Date().toISOString(),
        updated_at: conv.updated_at || new Date().toISOString(),
      })) as Conversation[];
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          query.refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [query]);

  return query;
};