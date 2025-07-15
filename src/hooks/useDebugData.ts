import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useEffect } from "react";

type SystemLog = Tables<"system_logs">;
type WebhookLog = Tables<"webhook_logs">;
type Integration = Tables<"integrations">;

export function useSystemLogs() {
  return useQuery({
    queryKey: ["system_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
        
      if (error) throw error;
      return data as SystemLog[];
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });
}

export function useWebhookLogs() {
  return useQuery({
    queryKey: ["webhook_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
        
      if (error) throw error;
      return data as WebhookLog[];
    },
    refetchInterval: 5000,
  });
}

export function useIntegrations() {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      return data as Integration[];
    },
  });
}

export function useWhatsAppTest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ to, content }: { to: string; content: string }) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          to,
          type: 'text',
          content
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalida os logs para mostrar a nova requisição
      queryClient.invalidateQueries({ queryKey: ["system_logs"] });
      queryClient.invalidateQueries({ queryKey: ["webhook_logs"] });
    },
  });
}

export function useConnectionStatus() {
  return useQuery({
    queryKey: ["connection_status"],
    queryFn: async () => {
      try {
        // Verifica se a integração Meta está configurada
        const { data: integrations } = await supabase
          .from("integrations")
          .select("*")
          .eq("type", "meta_whatsapp")
          .eq("active", true);

        const metaActive = integrations && integrations.length > 0;

        // Verifica logs recentes de erro
        const { data: recentErrors } = await supabase
          .from("system_logs")
          .select("*")
          .eq("type", "error")
          .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Últimos 5 minutos
          .limit(5);

        return {
          meta_whatsapp: metaActive ? 'connected' : 'disconnected',
          whapi: 'connected', // Mock por enquanto
          dify: 'connected', // Mock por enquanto
          grok: 'connected', // Mock por enquanto
          claude: 'connected', // Mock por enquanto
          recent_errors: recentErrors || [],
        };
      } catch (error) {
        console.error('Erro ao verificar status das conexões:', error);
        return {
          meta_whatsapp: 'error',
          whapi: 'error',
          dify: 'error',
          grok: 'error',
          claude: 'error',
          recent_errors: [],
        };
      }
    },
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });
}

// Hook para escutar mudanças em tempo real
export function useRealtimeLogs() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Configura listener para system_logs
    const systemLogsChannel = supabase
      .channel('system_logs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_logs'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["system_logs"] });
        }
      )
      .subscribe();

    // Configura listener para webhook_logs
    const webhookLogsChannel = supabase
      .channel('webhook_logs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_logs'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["webhook_logs"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(systemLogsChannel);
      supabase.removeChannel(webhookLogsChannel);
    };
  }, [queryClient]);
}