import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationMessage {
  id: string;
  content: string | null;
  sender_type: string;
  sender_name: string | null;
  message_type: string | null;
  media_url: string | null;
  created_at: string | null;
  metadata: any;
}

export interface ConversationHistory {
  conversation: {
    id: string;
    customer_name: string | null;
    phone_number: string;
    status: string | null;
    created_at: string | null;
    assigned_seller_id: string | null;
    seller_name?: string;
  };
  messages: ConversationMessage[];
  totalMessages: number;
}

export function useConversationHistory(conversationId: string | null) {
  return useQuery({
    queryKey: ['conversation-history', conversationId],
    queryFn: async (): Promise<ConversationHistory | null> => {
      if (!conversationId) return null;

      // Buscar dados da conversa
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .select(`
          *,
          sellers (
            name
          )
        `)
        .eq('id', conversationId)
        .single();

      if (conversationError) throw conversationError;

      // Buscar mensagens da conversa
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      return {
        conversation: {
          ...conversation,
          seller_name: conversation.sellers?.name
        },
        messages: messages || [],
        totalMessages: messages?.length || 0
      };
    },
    enabled: !!conversationId,
  });
}