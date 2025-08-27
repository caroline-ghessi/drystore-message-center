import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Play, Settings, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface QueueStats {
  total_messages: number;
  waiting_messages: number;
  error_messages: number;
  sent_messages: number;
}

export function CronJobManager() {
  const queryClient = useQueryClient();
  
  // Buscar estatísticas da fila
  const { data: queueStats } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_queue')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      
      const stats: QueueStats = {
        total_messages: data.length,
        waiting_messages: data.filter(m => m.status === 'waiting').length,
        error_messages: data.filter(m => m.status === 'error').length,
        sent_messages: data.filter(m => m.status === 'sent').length,
      };
      
      return stats;
    },
    refetchInterval: 10000,
  });

  // Limpar mensagens inválidas da fila
  const cleanupInvalidMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .rpc('cleanup_invalid_queue_messages');
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const result = data as { deleted_count?: number };
      toast.success(`${result.deleted_count || 0} mensagens inválidas removidas`);
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
    onError: (error: any) => {
      console.error('Erro ao limpar mensagens:', error);
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Processar mensagens manualmente
  const processMessagesMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('bot-dify-processor', {
        body: { manual_trigger: true }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const result = data as { processed_count?: number };
      toast.success(`Processamento concluído: ${result.processed_count || 0} mensagens processadas`);
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
    onError: (error: any) => {
      console.error('Erro ao processar mensagens:', error);
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Processar mensagem específica da Caroline (para teste)
  const processCarolineMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .rpc('process_caroline_message');
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const result = data as { caroline_processed?: boolean };
      if (result.caroline_processed) {
        toast.success('Mensagem da Caroline processada com sucesso!');
      } else {
        toast.info('Mensagem da Caroline não encontrada na fila');
      }
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
    onError: (error: any) => {
      console.error('Erro ao processar Caroline:', error);
      toast.error(`Erro: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      {/* Stats da Fila */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Status da Fila de Mensagens (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{queueStats?.total_messages || 0}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{queueStats?.waiting_messages || 0}</div>
              <div className="text-sm text-muted-foreground">Aguardando</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{queueStats?.error_messages || 0}</div>
              <div className="text-sm text-muted-foreground">Erros</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{queueStats?.sent_messages || 0}</div>
              <div className="text-sm text-muted-foreground">Enviadas</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diagnóstico do Problema */}
      {(queueStats?.waiting_messages || 0) > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-5 w-5" />
              Problema Detectado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700 mb-4">
              Há <strong>{queueStats?.waiting_messages} mensagens aguardando</strong> processamento. 
              Isso pode indicar conflitos entre cron jobs ou problemas no processador Dify.
            </p>
            <div className="space-y-2 text-sm text-orange-600">
              <p>• Múltiplos cron jobs podem estar causando race conditions</p>
              <p>• O bot-dify-processor pode estar falhando silenciosamente</p>
              <p>• Mensagens podem estar presas em conversas em fallback_mode</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações de Correção */}
      <Card>
        <CardHeader>
          <CardTitle>Ações de Correção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => processMessagesMutation.mutate()}
              disabled={processMessagesMutation.isPending}
              className="flex items-center gap-2"
            >
              {processMessagesMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Processar Mensagens Pendentes
            </Button>
            
            <Button
              variant="outline"
              onClick={() => cleanupInvalidMutation.mutate()}
              disabled={cleanupInvalidMutation.isPending}
              className="flex items-center gap-2"
            >
              {cleanupInvalidMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Limpar Mensagens Inválidas
            </Button>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Testes Específicos:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => processCarolineMutation.mutate()}
                disabled={processCarolineMutation.isPending}
                className="flex items-center gap-2"
              >
                {processCarolineMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Processar Caroline (Teste)
              </Button>
              
              <Button
                variant="outline"
                onClick={() => queryClient.invalidateQueries()}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar Todos os Dados
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Atual */}
      <Card>
        <CardHeader>
          <CardTitle>Status do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span>Cron Job: bot-dify-processor</span>
              <Badge variant="default">Ativo (a cada 2min)</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span>Cron Job: cleanup-message-queue</span>
              <Badge variant="default">Ativo (a cada hora)</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-red-50 rounded">
              <span>Outros cron jobs detectados</span>
              <Badge variant="destructive">Conflitantes</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}