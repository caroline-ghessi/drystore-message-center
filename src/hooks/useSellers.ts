import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Seller = Tables<"sellers">;

export function useSellers() {
  const { data: sellers = [], isLoading, error } = useQuery({
    queryKey: ["sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sellers")
        .select("*")
        .eq("active", true)
        .order("name");
        
      if (error) throw error;
      return data as Seller[];
    },
  });

  return {
    sellers,
    isLoading,
    error
  };
}

export function useActiveSellers() {
  return useQuery({
    queryKey: ["sellers", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sellers")
        .select("*")
        .eq("active", true)
        .order("name");
        
      if (error) throw error;
      return data as Seller[];
    },
  });
}

export function useDeleteSeller() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sellerId: string) => {
      // Soft delete - mark as inactive instead of deleting
      const { error: sellerError } = await supabase
        .from("sellers")
        .update({ active: false })
        .eq("id", sellerId);

      if (sellerError) throw sellerError;

      // Log the deletion
      const { error: logError } = await supabase
        .from("system_logs")
        .insert({
          type: "seller_deleted",
          source: "admin_action",
          message: `Vendedor marcado como inativo`,
          details: {
            seller_id: sellerId,
          },
        });

      if (logError) throw logError;

      return { sellerId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sellers"] });
    },
  });
}

export function useTransferToSeller() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      sellerId, 
      customerName, 
      phoneNumber, 
      notes 
    }: {
      conversationId: string;
      sellerId: string;
      customerName: string;
      phoneNumber: string;
      notes?: string;
    }) => {
      // 1. Criar o lead
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert({
          conversation_id: conversationId,
          seller_id: sellerId,
          customer_name: customerName,
          phone_number: phoneNumber,
          status: "attending",
          summary: notes || "Lead transferido manualmente via modo fallback",
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // 2. Atualizar a conversa
      const { error: conversationError } = await supabase
        .from("conversations")
        .update({
          status: "sent_to_seller",
          assigned_seller_id: sellerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      if (conversationError) throw conversationError;

      // 3. Log da transferência
      const { error: logError } = await supabase
        .from("system_logs")
        .insert({
          type: "transfer",
          source: "manual_fallback",
          message: `Conversa transferida manualmente para vendedor`,
          details: {
            conversation_id: conversationId,
            seller_id: sellerId,
            customer_name: customerName,
            notes: notes,
          },
        });

      if (logError) throw logError;

      return lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}