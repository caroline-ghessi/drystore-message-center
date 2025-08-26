import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface OfficialMessage {
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

export const useOfficialMessages = (conversationId: string | null) => {
  const query = useQuery({
    queryKey: ['official-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('message_source', 'meta') // Filtrar apenas mensagens do WhatsApp oficial
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mensagens oficiais:', error);
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
      })) as OfficialMessage[];
    },
    enabled: !!conversationId,
    refetchInterval: 3000, // Atualiza a cada 3 segundos
  });

  // Real-time updates for official messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`official-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          // Only refetch if it's for this conversation and meta source
          const isThisConversation = (payload.new && typeof payload.new === 'object' && 'conversation_id' in payload.new && payload.new.conversation_id === conversationId) || 
                                   (payload.old && typeof payload.old === 'object' && 'conversation_id' in payload.old && payload.old.conversation_id === conversationId);
          const isMetaSource = (payload.new && typeof payload.new === 'object' && 'message_source' in payload.new && payload.new.message_source === 'meta') || 
                              (payload.old && typeof payload.old === 'object' && 'message_source' in payload.old && payload.old.message_source === 'meta');
          
          if (isThisConversation && isMetaSource) {
            query.refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, query]);

  return query;
};