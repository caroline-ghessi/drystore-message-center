
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageCircle, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  Send, 
  AlertCircle,
  Phone,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMessageRetry } from "@/hooks/useMessageRetry";

interface MessageLog {
  id: string;
  whapi_message_id: string;
  phone_from: string;
  phone_to: string;
  content: string;
  status: string;
  direction: 'sent' | 'received';
  seller_id?: string;
  created_at: string;
  sellers?: {
    name: string;
  };
}

export function MessageDeliveryMonitor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { retryMessage, isLoading, testRodrigoBot } = useMessageRetry();
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  // Buscar logs de mensagens do Rodrigo Bot
  const { data: messageLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['message-delivery-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whapi_logs')
        .select(`
          *,
          sellers(name)
        `)
        .eq('direction', 'sent')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as MessageLog[];
    },
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  // Buscar leads pendentes de envio
  const { data: pendingLeads } = useQuery({
    queryKey: ['pending-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          sellers!inner(name, phone_number)
        `)
        .in('status', ['attending', 'sent_to_seller'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const handleRetryMessage = async (leadId: string) => {
    try {
      await retryMessage({ leadId, force: true });
      queryClient.invalidateQueries({ queryKey: ['message-delivery-logs'] });
      queryClient.invalidateQueries({ queryKey: ['pending-leads'] });
    } catch (error) {
      console.error('Erro no retry:', error);
    }
  };

  const handleTestRodrigoBot = async (sellerPhone: string) => {
    try {
      await testRodrigoBot(sellerPhone);
      queryClient.invalidateQueries({ queryKey: ['message-delivery-logs'] });
    } catch (error) {
      console.error('Erro no teste:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge variant="default" className="text-green-600 bg-green-50"><CheckCircle className="w-3 h-3 mr-1" />Entregue</Badge>;
      case 'read':
        return <Badge variant="default" className="text-blue-600 bg-blue-50"><CheckCircle className="w-3 h-3 mr-1" />Lida</Badge>;
      case 'sent':
        return <Badge variant="secondary" className="text-orange-600 bg-orange-50"><Clock className="w-3 h-3 mr-1" />Enviada</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="text-yellow-600 bg-yellow-50"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const pendingCount = messageLogs?.filter(m => ['sent', 'pending'].includes(m.status)).length || 0;
  const failedCount = messageLogs?.filter(m => m.status === 'failed').length || 0;
  const deliveredCount = messageLogs?.filter(m => ['delivered', 'read'].includes(m.status)).length || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <span>Monitor de Entrega de Mensagens</span>
              </CardTitle>
              <CardDescription>
                Monitora e controla entregas do Rodrigo Bot
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="default" className="text-green-600">
                {deliveredCount} Entregues
              </Badge>
              <Badge variant="secondary" className="text-orange-600">
                {pendingCount} Pendentes
              </Badge>
              {failedCount > 0 && (
                <Badge variant="destructive">
                  {failedCount} Falhas
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['message-delivery-logs'] });
                queryClient.invalidateQueries({ queryKey: ['pending-leads'] });
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            
            <Button
              variant="secondary"
              onClick={() => handleTestRodrigoBot('5551981690036')}
              disabled={isLoading}
            >
              <Send className="w-4 h-4 mr-2" />
              Teste Rodrigo Bot
            </Button>
          </div>

          {isLoadingLogs ? (
            <div className="text-center py-4">Carregando...</div>
          ) : (
            <div className="space-y-3">
              {messageLogs?.map((message) => (
                <div
                  key={message.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">
                        {message.sellers?.name || 'Vendedor'}
                      </span>
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">{message.phone_to}</span>
                      {getStatusBadge(message.status)}
                    </div>
                    <div className="text-sm text-gray-600">
                      <p className="truncate max-w-md mb-1">
                        {message.content?.substring(0, 100)}...
                      </p>
                      <div className="flex items-center space-x-4 text-xs">
                        <span>Enviado: {formatDateTime(message.created_at)}</span>
                        {message.whapi_message_id && (
                          <span>ID: {message.whapi_message_id}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {['sent', 'pending'].includes(message.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Buscar lead relacionado para retry
                          const lead = pendingLeads?.find(l => 
                            l.sellers.phone_number === message.phone_to
                          );
                          if (lead) {
                            handleRetryMessage(lead.id);
                          }
                        }}
                        disabled={isLoading}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Reenviar
                      </Button>
                    )}
                    
                    {message.status === 'failed' && (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
              
              {messageLogs?.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma mensagem encontrada nas últimas 24h
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção de Leads Pendentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span>Leads Pendentes de Confirmação</span>
          </CardTitle>
          <CardDescription>
            Leads que podem precisar de reenvio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingLeads?.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium">{lead.customer_name}</span>
                    <Badge variant="outline">{lead.status}</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Vendedor: {lead.sellers.name}</p>
                    <p>Telefone: {lead.sellers.phone_number}</p>
                    <p>Criado: {formatDateTime(lead.created_at)}</p>
                  </div>
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRetryMessage(lead.id)}
                  disabled={isLoading}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Reenviar Resumo
                </Button>
              </div>
            ))}
            
            {pendingLeads?.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                Nenhum lead pendente
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
