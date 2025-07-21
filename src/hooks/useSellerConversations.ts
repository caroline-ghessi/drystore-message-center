
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface SellerConversation {
  id: string;
  customer_name: string;
  phone_number: string;
  status: string;
  last_message: string;
  last_message_at: string;
  seller_id: string;
  seller_name: string;
  total_messages: number;
  unread_count: number;
}

export const useSellerConversations = (sellerId?: string, status?: string) => {
  const query = useQuery({
    queryKey: ['seller-conversations', sellerId, status],
    queryFn: async () => {
      let query = supabase
        .from('conversations')
        .select(`
          id,
          customer_name,
          phone_number,
          status,
          created_at,
          updated_at,
          leads!inner(
            seller_id,
            status
          ),
          sellers!inner(
            name
          )
        `)
        .not('leads.seller_id', 'is', null)
        .order('updated_at', { ascending: false });

      if (sellerId) {
        query = query.eq('leads.seller_id', sellerId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data: conversations, error } = await query;

      if (error) {
        console.error('Erro ao buscar conversas dos vendedores:', error);
        throw error;
      }

      // Buscar última mensagem e contagem para cada conversa
      const conversationsWithDetails = await Promise.all(
        (conversations || []).map(async (conv) => {
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at, sender_type')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const { count: totalMessages } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id);

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .eq('sender_type', 'customer');

          return {
            id: conv.id,
            customer_name: conv.customer_name || 'Cliente',
            phone_number: conv.phone_number,
            status: conv.status,
            last_message: lastMessage?.content || '',
            last_message_at: lastMessage?.created_at || conv.updated_at,
            seller_id: conv.leads[0]?.seller_id || '',
            seller_name: conv.sellers[0]?.name || '',
            total_messages: totalMessages || 0,
            unread_count: unreadCount || 0,
          } as SellerConversation;
        })
      );

      return conversationsWithDetails;
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('seller-conversations-changes')
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
