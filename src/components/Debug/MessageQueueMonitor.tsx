import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QueueMessage {
  id: string;
  conversation_id: string;
  messages_content: string[];
  status: string;
  created_at: string;
  scheduled_for: string;
  processed_at: string | null;
}

export function MessageQueueMonitor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  // Busca mensagens na fila
  const { data: queueMessages, isLoading } = useQuery({
    queryKey: ['message-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_queue')
        .select(`
          *,
          conversations!inner(customer_name, phone_number)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as (QueueMessage & { conversations: { customer_name: string; phone_number: string } })[];
    },
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  // Processa mensagens pendentes
  const processMessagesMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('dify-process-messages');
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Processamento concluído",
        description: `${data.processed} mensagens processadas, ${data.errors} erros`,
      });
      queryClient.invalidateQueries({ queryKey: ['message-queue'] });
    },
    onError: (error) => {
      toast({
        title: "Erro no processamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleProcessPendingMessages = async () => {
    setIsProcessing(true);
    try {
      await processMessagesMutation.mutateAsync();
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Badge variant="secondary" className="text-orange-600 bg-orange-50"><Clock className="w-3 h-3 mr-1" />Aguardando</Badge>;
      case 'sent':
        return <Badge variant="default" className="text-green-600 bg-green-50"><CheckCircle className="w-3 h-3 mr-1" />Enviado</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      case 'skipped':
        return <Badge variant="outline"><AlertTriangle className="w-3 h-3 mr-1" />Ignorado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const pendingCount = queueMessages?.filter(m => m.status === 'waiting').length || 0;
  const errorCount = queueMessages?.filter(m => m.status === 'error').length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-primary" />
              <span>Monitor da Fila de Mensagens</span>
            </CardTitle>
            <CardDescription>
              Monitora e processa mensagens pendentes do Dify
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-orange-600">
              {pendingCount} Pendentes
            </Badge>
            {errorCount > 0 && (
              <Badge variant="destructive">
                {errorCount} Erros
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Button
            onClick={handleProcessPendingMessages}
            disabled={isProcessing || pendingCount === 0}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>
              {isProcessing 
                ? 'Processando...' 
                : `Processar ${pendingCount} Pendentes`
              }
            </span>
          </Button>
          
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['message-queue'] })}
          >
            Atualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-4">Carregando...</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {queueMessages?.map((message) => (
              <div
                key={message.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium">
                      {message.conversations.customer_name || message.conversations.phone_number}
                    </span>
                    {getStatusBadge(message.status)}
                  </div>
                  <div className="text-sm text-gray-600">
                    <p className="truncate max-w-md">
                      {message.messages_content?.join(' ') || 'Sem conteúdo'}
                    </p>
                    <p className="text-xs mt-1">
                      Criado: {formatDateTime(message.created_at)}
                      {message.processed_at && ` | Processado: ${formatDateTime(message.processed_at)}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {queueMessages?.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Nenhuma mensagem na fila
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}