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
        .eq("deleted", false)
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
        .eq("deleted", false)
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
      console.log("🗑️ Iniciando exclusão do vendedor:", sellerId);
      
      // True delete - mark as deleted (removes from interface)
      const { error: sellerError } = await supabase
        .from("sellers")
        .update({ deleted: true })
        .eq("id", sellerId);

      if (sellerError) {
        console.error("❌ Erro ao marcar vendedor como excluído:", sellerError);
        throw sellerError;
      }

      console.log("✅ Vendedor marcado como excluído com sucesso");

      // Log the deletion
      const { error: logError } = await supabase
        .from("system_logs")
        .insert({
          type: "seller_deleted",
          source: "admin_action",
          message: `Vendedor excluído`,
          details: {
            seller_id: sellerId,
          },
        });

      if (logError) {
        console.warn("⚠️ Erro ao criar log, mas exclusão foi bem-sucedida:", logError);
      }

      return { sellerId };
    },
    onSuccess: (data) => {
      console.log("🔄 Invalidando cache após exclusão bem-sucedida:", data.sellerId);
      
      // Invalidate all seller-related queries
      queryClient.invalidateQueries({ queryKey: ["sellers"] });
      queryClient.invalidateQueries({ queryKey: ["sellers", "active"] });
      
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ["sellers"] });
      
      console.log("✅ Cache invalidado e refetch forçado");
    },
    onError: (error) => {
      console.error("❌ Erro na exclusão do vendedor:", error);
    },
  });
}

export function useUpdateSeller() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      console.log("📝 Atualizando vendedor:", id, data);
      
      const { error } = await supabase
        .from("sellers")
        .update(data)
        .eq("id", id);

      if (error) {
        console.error("❌ Erro ao atualizar vendedor:", error);
        throw error;
      }

      console.log("✅ Vendedor atualizado com sucesso");
      return { id, ...data };
    },
    onSuccess: (data) => {
      console.log("🔄 Invalidando cache após atualização:", data.id);
      
      // Invalidate all seller-related queries
      queryClient.invalidateQueries({ queryKey: ["sellers"] });
      queryClient.invalidateQueries({ queryKey: ["sellers", "active"] });
      
      console.log("✅ Cache invalidado após atualização");
    },
    onError: (error) => {
      console.error("❌ Erro na atualização do vendedor:", error);
    },
  });
}

export function useRestoreSeller() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sellerId: string) => {
      const { error } = await supabase
        .from("sellers")
        .update({ deleted: false })
        .eq("id", sellerId);

      if (error) throw error;
      return { sellerId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sellers"] });
      queryClient.invalidateQueries({ queryKey: ["sellers", "active"] });
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