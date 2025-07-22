
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

  // Buscar mensagens pendentes
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
        .in('status', ['sent', 'pending'])
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
    refetchInterval: 30000 // Refetch a cada 30 segundos
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

  // Verificar todos os status pendentes
  const checkAllPendingStatus = async () => {
    setIsChecking(true);
    try {
      let checkedCount = 0;
      let updatedCount = 0;

      for (const delivery of pendingDeliveries.filter(d => d.status === 'pending')) {
        try {
          await checkMessageStatus.mutateAsync(delivery.id);
          checkedCount++;
          
          // Pequeno delay para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 500));
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

  // Reenviar mensagem falhada
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
        description: `Mensagem reenviada para ${data.seller_name}`,
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

  // Validar número de telefone
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

    return { isValid: true, formatted, warnings };
  };

  return {
    pendingDeliveries,
    isLoading,
    isChecking,
    checkAllPendingStatus,
    retryFailedMessage: retryFailedMessage.mutate,
    isRetrying: retryFailedMessage.isPending,
    validatePhoneNumber
  };
};
