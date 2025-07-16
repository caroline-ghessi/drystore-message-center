import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { whapiService } from '@/services/whapiService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface WhapiConfig {
  id?: string;
  name: string;
  phone_number: string;
  type: 'rodrigo_bot' | 'seller';
  seller_id?: string;
  active: boolean;
}

export const useWhapiIntegration = () => {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar configurações WHAPI
  const { data: configurations = [], isLoading: loadingConfigs } = useQuery({
    queryKey: ['whapi-configurations'],
    queryFn: () => whapiService.getConfigurations(),
    refetchInterval: 30000 // Refetch a cada 30 segundos
  });

  // Buscar logs WHAPI
  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['whapi-logs'],
    queryFn: () => whapiService.getLogs(50),
    refetchInterval: 10000 // Refetch a cada 10 segundos
  });

  // Mutação para configurar webhook
  const configureWebhook = useMutation({
    mutationFn: async ({ 
      token, 
      phoneNumber, 
      type, 
      sellerId 
    }: { 
      token: string; 
      phoneNumber: string; 
      type: 'rodrigo_bot' | 'seller'; 
      sellerId?: string; 
    }) => {
      setIsConfiguring(true);
      return await whapiService.configureWebhook(token, phoneNumber, type, sellerId);
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Webhook configurado!",
        description: `WHAPI configurado com sucesso para ${variables.phoneNumber}`,
      });
      
      // Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ['whapi-configurations'] });
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
      
      setIsConfiguring(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na configuração",
        description: error.message,
        variant: "destructive",
      });
      setIsConfiguring(false);
    }
  });

  // Mutação para testar conexão
  const testConnection = useMutation({
    mutationFn: async (token: string) => {
      const isConnected = await whapiService.testConnection(token);
      if (!isConnected) {
        throw new Error('Token WHAPI inválido ou inativo');
      }
      return isConnected;
    },
    onSuccess: () => {
      toast({
        title: "Conexão OK!",
        description: "Token WHAPI está funcionando corretamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na conexão",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutação para enviar mensagem de teste
  const sendTestMessage = useMutation({
    mutationFn: async ({ 
      token, 
      phoneNumber, 
      message 
    }: { 
      token: string; 
      phoneNumber: string; 
      message: string; 
    }) => {
      return await whapiService.sendMessage(token, phoneNumber, message);
    },
    onSuccess: (data) => {
      toast({
        title: "Mensagem enviada!",
        description: `Mensagem de teste enviada com sucesso. ID: ${data.message_id}`,
      });
      
      // Atualizar logs
      queryClient.invalidateQueries({ queryKey: ['whapi-logs'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no envio",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Buscar URL do webhook para um seller
  const getWebhookUrl = (sellerId?: string) => {
    const projectId = 'groqsnnytvjabgeaekkw';
    return `https://${projectId}.supabase.co/functions/v1/whapi-webhook`;
  };

  // Verificar se vendedor tem WHAPI configurado
  const isSellerConnected = (sellerId: string) => {
    return configurations.some(
      config => config.type === 'seller' && 
                config.seller_id === sellerId && 
                config.active &&
                config.health_status === 'healthy'
    );
  };

  // Verificar se Rodrigo Bot está configurado
  const isRodrigoBotConnected = () => {
    return configurations.some(
      config => config.type === 'rodrigo_bot' && 
                config.active &&
                config.health_status === 'healthy'
    );
  };

  // Buscar configuração específica
  const getConfiguration = (type: 'rodrigo_bot' | 'seller', sellerId?: string) => {
    return configurations.find(config => {
      if (config.type !== type) return false;
      if (type === 'seller' && config.seller_id !== sellerId) return false;
      return true;
    });
  };

  // Atualizar status de health check
  const updateHealthStatus = useMutation({
    mutationFn: async (configId: string) => {
      // Buscar configuração
      const config = configurations.find(c => c.id === configId);
      if (!config) throw new Error('Configuração não encontrada');

      // Simular teste de saúde (pode ser implementado com chamada real)
      const isHealthy = Math.random() > 0.1; // 90% de chance de estar saudável
      
      // Atualizar no banco
      const { error } = await supabase
        .from('whapi_configurations')
        .update({
          health_status: isHealthy ? 'healthy' : 'unhealthy',
          last_health_check: new Date().toISOString()
        })
        .eq('id', configId);

      if (error) throw error;

      return isHealthy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whapi-configurations'] });
    }
  });

  return {
    // Dados
    configurations,
    logs,
    
    // Estados
    loadingConfigs,
    loadingLogs,
    isConfiguring,
    
    // Mutações
    configureWebhook: configureWebhook.mutate,
    testConnection: testConnection.mutate,
    sendTestMessage: sendTestMessage.mutate,
    updateHealthStatus: updateHealthStatus.mutate,
    
    // Estados das mutações
    isConfiguringWebhook: configureWebhook.isPending,
    isTestingConnection: testConnection.isPending,
    isSendingTest: sendTestMessage.isPending,
    isUpdatingHealth: updateHealthStatus.isPending,
    
    // Helpers
    getWebhookUrl,
    isSellerConnected,
    isRodrigoBotConnected,
    getConfiguration
  };
};