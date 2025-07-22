
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeliveryStatus {
  id: string;
  seller_name: string;
  seller_phone: string;
  message_id?: string;
  status: 'pending' | 'delivered' | 'failed' | 'read';
  sent_at: string;
  last_checked: string;
  retry_count: number;
  error_message?: string;
}

export const useDeliveryMonitoring = () => {
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar mensagens pendentes com melhor filtragem
  const { data: pendingDeliveries = [], isLoading } = useQuery({
    queryKey: ['pending-deliveries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whapi_logs')
        .select(`
          id,
          whapi_message_id,
          phone_to,
          content,
          status,
          created_at,
          error_message,
          metadata,
          sellers!inner(name)
        `)
        .eq('direction', 'sent')
        .in('status', ['sent', 'pending', 'failed'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(log => ({
        id: log.id,
        seller_name: log.sellers?.name || 'Vendedor',
        seller_phone: log.phone_to,
        message_id: log.whapi_message_id,
        status: log.status === 'sent' ? 'pending' : log.status,
        sent_at: log.created_at,
        last_checked: log.created_at,
        retry_count: (log.metadata as any)?.retry_count || 0,
        error_message: log.error_message
      })) as DeliveryStatus[];
    },
    refetchInterval: 15000 // Refetch a cada 15 segundos para monitor mais ativo
  });

  // Verificar status de uma mensagem específica
  const checkMessageStatus = useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await supabase.functions.invoke('check-message-status', {
        body: { messageId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-deliveries'] });
    }
  });

  // Verificar todos os status pendentes com melhor controle
  const checkAllPendingStatus = async () => {
    setIsChecking(true);
    try {
      let checkedCount = 0;
      const pendingMessages = pendingDeliveries.filter(d => 
        d.status === 'pending' || d.status === 'sent'
      );

      for (const delivery of pendingMessages) {
        try {
          await checkMessageStatus.mutateAsync(delivery.id);
          checkedCount++;
          
          // Delay para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`Erro ao verificar status da mensagem ${delivery.id}:`, error);
        }
      }

      toast({
        title: "Status verificado",
        description: `Status verificado para ${checkedCount} mensagens`,
      });
      
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao verificar status das mensagens",
        variant: "destructive"
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Reenviar mensagem falhada com melhor handling
  const retryFailedMessage = useMutation({
    mutationFn: async (deliveryId: string) => {
      const { data, error } = await supabase.functions.invoke('retry-failed-delivery', {
        body: { deliveryId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Mensagem reenviada",
        description: `Mensagem reenviada para ${data.seller}`,
      });
      queryClient.invalidateQueries({ queryKey: ['pending-deliveries'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no reenvio",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Validar número de telefone com validação melhorada
  const validatePhoneNumber = (phoneNumber: string): { isValid: boolean; formatted: string; warnings: string[] } => {
    const warnings: string[] = [];
    let formatted = phoneNumber.replace(/\D/g, '');
    
    // Verificações básicas
    if (!formatted) {
      return { isValid: false, formatted: '', warnings: ['Número vazio'] };
    }

    // Remover zeros à esquerda
    formatted = formatted.replace(/^0+/, '');

    // Verificar se já tem código do país
    if (!formatted.startsWith('55')) {
      if (formatted.length >= 10 && formatted.length <= 11) {
        formatted = '55' + formatted;
        warnings.push('Código do país (55) adicionado automaticamente');
      } else {
        warnings.push('Número com formato suspeito');
      }
    }

    // Validar comprimento final
    if (formatted.length < 12 || formatted.length > 13) {
      warnings.push(`Comprimento inválido: ${formatted.length} dígitos`);
      return { isValid: false, formatted, warnings };
    }

    // Verificar se é número brasileiro válido
    if (!formatted.startsWith('55')) {
      warnings.push('Não é um número brasileiro');
      return { isValid: false, formatted, warnings };
    }

    // Verificar DDD válido (11-99)
    const ddd = formatted.substring(2, 4);
    if (parseInt(ddd) < 11 || parseInt(ddd) > 99) {
      warnings.push(`DDD inválido: ${ddd}`);
      return { isValid: false, formatted, warnings };
    }

    // Verificar se é celular (deve começar com 9)
    const numberPart = formatted.substring(4);
    if (numberPart.length === 9 && !numberPart.startsWith('9')) {
      warnings.push('Número pode ser fixo - WhatsApp requer celular');
    }

    return { isValid: true, formatted, warnings };
  };

  // Monitoramento automático de mensagens pendentes com melhor controle
  const monitorPendingMessages = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whapi-monitor-pending');
      
      if (error) throw error;
      
      toast({
        title: "Monitoramento executado",
        description: `${data.checked_count} mensagens verificadas, ${data.error_count} erros`,
      });
      
      // Refetch dos dados após monitoramento
      queryClient.invalidateQueries({ queryKey: ['pending-deliveries'] });
      
    } catch (error) {
      console.error('Erro no monitoramento:', error);
      toast({
        title: "Erro no monitoramento",
        description: "Falha ao verificar mensagens pendentes",
        variant: "destructive"
      });
    }
  };

  // Estatísticas de entrega
  const deliveryStats = {
    total: pendingDeliveries.length,
    pending: pendingDeliveries.filter(d => d.status === 'pending' || d.status === 'sent').length,
    delivered: pendingDeliveries.filter(d => d.status === 'delivered').length,
    failed: pendingDeliveries.filter(d => d.status === 'failed').length,
    read: pendingDeliveries.filter(d => d.status === 'read').length,
    deliveryRate: pendingDeliveries.length > 0 
      ? ((pendingDeliveries.filter(d => d.status === 'delivered' || d.status === 'read').length / pendingDeliveries.length) * 100).toFixed(1)
      : '0'
  };

  return {
    pendingDeliveries,
    deliveryStats,
    isLoading,
    isChecking,
    checkAllPendingStatus,
    retryFailedMessage: retryFailedMessage.mutate,
    isRetrying: retryFailedMessage.isPending,
    validatePhoneNumber,
    monitorPendingMessages
  };
};
