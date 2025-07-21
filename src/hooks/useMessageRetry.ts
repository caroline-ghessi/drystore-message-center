
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RetryMessageData {
  leadId?: string;
  sellerId?: string;
  customerPhone?: string;
  customMessage?: string;
  force?: boolean;
}

interface PendingMessage {
  id: string;
  lead_id?: string;
  seller_id: string;
  seller_name: string;
  seller_phone: string;
  customer_phone?: string;
  message_id?: string;
  status: 'pending' | 'delivered' | 'failed';
  created_at: string;
  retry_count: number;
}

export function useMessageRetry() {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const retryMessage = async (data: RetryMessageData) => {
    setIsLoading(true);
    try {
      console.log('🔄 Iniciando retry de mensagem:', data);

      const { data: result, error } = await supabase.functions.invoke('retry-message', {
        body: data
      });

      if (error) {
        console.error('Erro na edge function retry-message:', error);
        throw error;
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Falha no retry da mensagem');
      }

      toast.success(`Mensagem reenviada com sucesso para ${result.seller}!`, {
        description: `ID da mensagem: ${result.message_id}`
      });

      return result;

    } catch (error) {
      console.error('Erro no retry:', error);
      toast.error(`Erro no reenvio: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const checkMessageStatus = async (whapiMessageId: string) => {
    setIsCheckingStatus(true);
    try {
      // Verificar status da mensagem nos logs WHAPI
      const { data: whapiLogs, error } = await supabase
        .from('whapi_logs')
        .select('*')
        .eq('whapi_message_id', whapiMessageId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      return whapiLogs?.[0] || null;

    } catch (error) {
      console.error('Erro ao verificar status:', error);
      toast.error('Erro ao verificar status da mensagem');
      return null;
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const getPendingMessages = async (): Promise<PendingMessage[]> => {
    try {
      // Buscar mensagens do Rodrigo Bot que podem estar pendentes
      const { data: whapiLogs, error } = await supabase
        .from('whapi_logs')
        .select(`
          *,
          sellers!inner(name)
        `)
        .eq('direction', 'sent')
        .in('status', ['sent', 'pending'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Últimas 24h
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (whapiLogs || []).map(log => ({
        id: log.id,
        seller_id: log.seller_id,
        seller_name: log.sellers?.name || 'Vendedor',
        seller_phone: log.phone_to,
        customer_phone: log.phone_from,
        message_id: log.whapi_message_id,
        status: (log.status === 'sent' ? 'pending' : log.status) as 'pending' | 'delivered' | 'failed',
        created_at: log.created_at,
        retry_count: 0 // TODO: implementar contador de retry
      })) as PendingMessage[];

    } catch (error) {
      console.error('Erro ao buscar mensagens pendentes:', error);
      return [];
    }
  };

  const testRodrigoBot = async (sellerPhone: string) => {
    setIsLoading(true);
    try {
      const testMessage = `🤖 *TESTE DO RODRIGO BOT*

Esta é uma mensagem de teste para verificar se a comunicação está funcionando corretamente.

⏰ Enviado em: ${new Date().toLocaleString('pt-BR')}

Se você recebeu esta mensagem, o Rodrigo Bot está funcionando! ✅`;

      const result = await retryMessage({
        sellerId: '', // Será buscado pelo telefone
        customerPhone: sellerPhone,
        customMessage: testMessage,
        force: true
      });

      toast.success('Mensagem de teste enviada!', {
        description: 'Verifique o WhatsApp do vendedor'
      });

      return result;

    } catch (error) {
      console.error('Erro no teste:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    retryMessage,
    checkMessageStatus,
    getPendingMessages,
    testRodrigoBot,
    isLoading,
    isCheckingStatus
  };
}
