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
        // Verifica integrações configuradas
        const { data: integrations } = await supabase
          .from("integrations")
          .select("*")
          .eq("active", true);

        // Verifica vendedores com WHAPI configurado
        const { data: sellers } = await supabase
          .from("sellers")
          .select("whapi_token")
          .eq("active", true)
          .not("whapi_token", "is", null);

        // Verifica logs recentes de sucesso (últimos 10 minutos)
        const { data: recentSuccessLogs } = await supabase
          .from("system_logs")
          .select("*")
          .eq("type", "success")
          .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
          .limit(20);

        // Verifica logs recentes de erro (últimos 5 minutos)
        const { data: recentErrors } = await supabase
          .from("system_logs")
          .select("*")
          .eq("type", "error")
          .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .limit(10);

        // Função para verificar status de uma integração
        const getServiceStatus = (serviceType: string) => {
          const integration = integrations?.find(i => i.type === serviceType);
          if (!integration) return 'not_configured';
          
          const hasRecentSuccess = recentSuccessLogs?.some(log => 
            log.source?.includes(serviceType) || log.message?.includes(serviceType)
          );
          const hasRecentError = recentErrors?.some(log => 
            log.source?.includes(serviceType) || log.message?.includes(serviceType)
          );
          
          if (hasRecentError && !hasRecentSuccess) return 'error';
          if (integration.active && hasRecentSuccess) return 'connected';
          if (integration.active) return 'connected';
          return 'disconnected';
        };

        // Status específico para Meta WhatsApp
        const metaIntegration = integrations?.find(i => i.type === 'meta');
        const metaRecentSuccess = recentSuccessLogs?.some(log => 
          log.source === 'whatsapp-send' && log.type === 'success'
        );
        const metaRecentError = recentErrors?.some(log => 
          log.source === 'whatsapp-send'
        );

        let metaStatus = 'not_configured';
        if (metaIntegration?.active) {
          if (metaRecentError && !metaRecentSuccess) {
            metaStatus = 'error';
          } else if (metaRecentSuccess || metaIntegration.active) {
            metaStatus = 'connected';
          } else {
            metaStatus = 'disconnected';
          }
        }

        // Status para WHAPI baseado em vendedores configurados
        const whapiStatus = sellers && sellers.length > 0 ? 'connected' : 'not_configured';

        return {
          meta_whatsapp: metaStatus,
          whapi: whapiStatus,
          dify: getServiceStatus('dify'),
          grok: getServiceStatus('grok'),
          claude: getServiceStatus('claude'),
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