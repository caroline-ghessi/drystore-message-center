import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface QueueMessage {
  id: string;
  conversation_id: string;
  messages_content: string[];
  status: 'waiting' | 'processing' | 'sent' | 'failed';
  retry_count: number;
  max_retries: number;
  last_error?: string;
  created_at: string;
  scheduled_for: string;
  processed_at?: string;
}

export function QueueMonitor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Buscar mensagens da fila
  const { data: queueMessages, isLoading } = useQuery({
    queryKey: ['queue-messages', selectedStatus],
    queryFn: async () => {
      let query = supabase
        .from('message_queue')
        .select(`
          *,
          conversations!inner (
            customer_name,
            phone_number
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (selectedStatus) {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar fila:', error);
        throw error;
      }

      return data as (QueueMessage & { conversations: { customer_name?: string; phone_number: string } })[];
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  // Estatísticas da fila
  const { data: queueStats } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_queue')
        .select('status');

      if (error) throw error;
      
      const stats = { waiting: 0, processing: 0, sent: 0, failed: 0, total: 0 };
      data?.forEach(item => {
        stats[item.status as keyof typeof stats] = (stats[item.status as keyof typeof stats] || 0) + 1;
        stats.total++;
      });
      
      return stats;
    },
    refetchInterval: 3000,
  });

  // Processar fila manualmente
  const processQueueMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-message-queue');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Fila processada",
        description: `Processadas: ${data.processed}, Erros: ${data.errors}, Puladas: ${data.skipped}`,
      });
      queryClient.invalidateQueries({ queryKey: ['queue-messages'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao processar fila",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Limpeza da fila
  const cleanupQueueMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('queue-cleanup');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Limpeza executada",
        description: `${data.total_cleaned} itens processados`,
      });
      queryClient.invalidateQueries({ queryKey: ['queue-messages'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
    onError: (error) => {
      toast({
        title: "Erro na limpeza",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string, retryCount?: number, maxRetries?: number) => {
    const variants = {
      waiting: 'default',
      processing: 'secondary',
      sent: 'outline',
      failed: 'destructive'
    } as const;

    const label = status === 'waiting' && retryCount && retryCount > 0 
      ? `${status} (${retryCount}/${maxRetries})` 
      : status;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {label}
      </Badge>
    );
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getTimeUntilScheduled = (scheduledFor: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledFor);
    const diffMs = scheduled.getTime() - now.getTime();
    
    if (diffMs <= 0) return "Pronto para processar";
    
    const diffSec = Math.ceil(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s`;
    
    const diffMin = Math.ceil(diffSec / 60);
    return `${diffMin}min`;
  };

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card 
          className={`cursor-pointer transition-colors ${selectedStatus === null ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setSelectedStatus(null)}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{queueStats?.total || 0}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        
        {['waiting', 'processing', 'sent', 'failed'].map(status => (
          <Card 
            key={status}
            className={`cursor-pointer transition-colors ${selectedStatus === status ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedStatus(selectedStatus === status ? null : status)}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">
                {queueStats?.[status as keyof typeof queueStats] || 0}
              </div>
              <div className="text-sm text-muted-foreground capitalize">{status}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        <Button
          onClick={() => processQueueMutation.mutate()}
          disabled={processQueueMutation.isPending}
          size="sm"
        >
          <Play className="w-4 h-4 mr-2" />
          Processar Fila
        </Button>
        
        <Button
          onClick={() => cleanupQueueMutation.mutate()}
          disabled={cleanupQueueMutation.isPending}
          variant="outline"
          size="sm"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Limpeza
        </Button>
        
        <Button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['queue-messages'] });
            queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
          }}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Lista de mensagens */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Fila de Mensagens
            {selectedStatus && (
              <Badge variant="outline">
                Filtro: {selectedStatus}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Carregando...</div>
          ) : !queueMessages || queueMessages.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              Nenhuma mensagem na fila
            </div>
          ) : (
            <div className="space-y-4">
              {queueMessages.map((message) => (
                <div
                  key={message.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {message.conversations.customer_name || message.conversations.phone_number}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {message.conversations.phone_number}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(message.status, message.retry_count, message.max_retries)}
                      {message.status === 'waiting' && (
                        <Badge variant="outline" className="text-xs">
                          {getTimeUntilScheduled(message.scheduled_for)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-sm">
                    <strong>Mensagens:</strong> {message.messages_content?.join(' ') || 'N/A'}
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Criado: {formatDateTime(message.created_at)}</span>
                    <span>Agendado: {formatDateTime(message.scheduled_for)}</span>
                    {message.processed_at && (
                      <span>Processado: {formatDateTime(message.processed_at)}</span>
                    )}
                  </div>

                  {message.last_error && (
                    <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-destructive">
                        <strong>Último erro:</strong> {message.last_error}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}