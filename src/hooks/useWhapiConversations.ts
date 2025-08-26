import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface WhapiConversation {
  id: string;
  phone_number: string;
  customer_name: string;
  status: 'bot_attending' | 'waiting_evaluation' | 'sent_to_seller' | 'finished' | 'fallback_active';
  last_message: string;
  last_message_at: string;
  last_sender_type: string;
  unread_count?: number;
  fallback_mode: boolean;
  fallback_taken_by?: string;
  assigned_seller_id?: string;
  seller_name?: string;
  total_messages: number;
  created_at: string;
  updated_at: string;
}

export const useWhapiConversations = (searchTerm?: string) => {
  const query = useQuery({
    queryKey: ['whapi-conversations', searchTerm],
    queryFn: async () => {
      // Buscar conversas que têm mensagens da fonte 'whapi' (vendedores)
      let baseQuery = supabase
        .from('conversations')
        .select(`
          id,
          phone_number,
          customer_name,
          status,
          fallback_mode,
          fallback_taken_by,
          assigned_seller_id,
          created_at,
          updated_at,
          sellers (
            name
          )
        `)
        .order('updated_at', { ascending: false });

      if (searchTerm) {
        baseQuery = baseQuery.or(`customer_name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`);
      }

      const { data: conversations, error } = await baseQuery;

      if (error) {
        console.error('Erro ao buscar conversas WHAPI:', error);
        throw error;
      }

      // Filtrar apenas conversas que têm mensagens da fonte 'whapi' e com vendedores
      const conversationsWithWhapi = await Promise.all(
        (conversations || []).map(async (conv) => {
          // Verificar se tem mensagens do whapi
          const { data: whapiMessages } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', conv.id)
            .eq('message_source', 'whapi')
            .limit(1);

          if (!whapiMessages || whapiMessages.length === 0) {
            return null; // Não tem mensagens whapi, pular
          }

          // Verificar se tem vendedor atribuído
          if (!conv.assigned_seller_id) {
            return null; // Não tem vendedor, pular
          }

          // Buscar última mensagem e contadores
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at, sender_type')
            .eq('conversation_id', conv.id)
            .eq('message_source', 'whapi')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const { count: totalMessages } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('message_source', 'whapi');

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('message_source', 'whapi')
            .eq('is_read', false)
            .eq('sender_type', 'customer');

          return {
            id: conv.id,
            phone_number: conv.phone_number || '',
            customer_name: conv.customer_name || 'Cliente',
            status: conv.status || 'sent_to_seller',
            last_message: lastMessage?.content || '',
            last_message_at: lastMessage?.created_at || conv.updated_at,
            last_sender_type: lastMessage?.sender_type || 'unknown',
            unread_count: unreadCount || 0,
            fallback_mode: conv.fallback_mode || false,
            fallback_taken_by: conv.fallback_taken_by,
            assigned_seller_id: conv.assigned_seller_id,
            seller_name: conv.sellers?.name,
            total_messages: totalMessages || 0,
            created_at: conv.created_at || new Date().toISOString(),
            updated_at: conv.updated_at || new Date().toISOString(),
          } as WhapiConversation;
        })
      );

      // Filtrar nulls e retornar
      return conversationsWithWhapi.filter(conv => conv !== null);
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('whapi-conversations-changes')
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
          table: 'messages',
          filter: 'message_source=eq.whapi'
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