import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'bot' | 'seller' | 'system';
  sender_name?: string;
  content?: string;
  message_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'reaction';
  media_url?: string;
  created_at: string;
  is_read: boolean;
  whatsapp_message_id?: string;
  reply_to_message_id?: string;
  metadata?: any;
  delivery_status: string;
}

export const useConversationMessages = (conversationId: string | null) => {
  const query = useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
        throw error;
      }

      return (data || []).map(msg => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_type: msg.sender_type,
        sender_name: msg.sender_name,
        content: msg.content,
        message_type: msg.message_type || 'text',
        media_url: msg.media_url,
        created_at: msg.created_at,
        is_read: msg.is_read,
        whatsapp_message_id: msg.whatsapp_message_id,
        reply_to_message_id: msg.reply_to_message_id,
        metadata: msg.metadata,
        delivery_status: msg.delivery_status || 'sent',
      })) as Message[];
    },
    enabled: !!conversationId,
    refetchInterval: 3000, // Atualiza a cada 3 segundos
  });

  // Real-time updates for messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        () => {
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, query]);

  return query;
};