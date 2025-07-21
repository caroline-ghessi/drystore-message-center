
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationStatus {
  botAttending: number;
  waitingEvaluation: number;
  withSellers: number;
  finished: number;
}

export const useConversationStatus = () => {
  return useQuery({
    queryKey: ['conversation-status'],
    queryFn: async (): Promise<ConversationStatus> => {
      const { data, error } = await supabase
        .from('conversations')
        .select('status');

      if (error) throw error;

      const statusCounts = (data || []).reduce((acc, conv) => {
        acc[conv.status] = (acc[conv.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        botAttending: statusCounts['bot_attending'] || 0,
        waitingEvaluation: statusCounts['waiting_evaluation'] || 0,
        withSellers: statusCounts['sent_to_seller'] || 0,
        finished: statusCounts['finished'] || 0
      };
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
};
