
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
  Send 
} from "lucide-react";
import { useMessageRetry } from "@/hooks/useMessageRetry";

export function DeliveryStatusPanel() {
  const queryClient = useQueryClient();
  const { retryMessage, isLoading } = useMessageRetry();

  // Buscar estatísticas de entrega das últimas 24h
  const { data: deliveryStats } = useQuery({
    queryKey: ['delivery-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whapi_logs')
        .select('status')
        .eq('direction', 'sent')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const stats = {
        total: data.length,
        delivered: data.filter(m => ['delivered', 'read'].includes(m.status)).length,
        pending: data.filter(m => ['sent', 'pending'].includes(m.status)).length,
        failed: data.filter(m => m.status === 'failed').length
      };

      stats.deliveryRate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;

      return stats;
    },
    refetchInterval: 30000,
  });

  // Buscar mensagens problemáticas
  const { data: problematicMessages } = useQuery({
    queryKey: ['problematic-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whapi_logs')
        .select(`
          *,
          sellers(name)
        `)
        .eq('direction', 'sent')
        .in('status', ['sent', 'pending', 'failed'])
        .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Últimas 2 horas
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const handleRetryAll = async () => {
    const pendingMessages = problematicMessages?.filter(m => ['sent', 'pending'].includes(m.status));
    if (!pendingMessages?.length) return;

    for (const message of pendingMessages) {
      if (message.seller_id) {
        try {
          await retryMessage({
            sellerId: message.seller_id,
            customerPhone: message.phone_to,
            customMessage: 'Mensagem de verificação do Rodrigo Bot',
            force: true
          });
        } catch (error) {
          console.error('Erro no retry:', error);
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ['delivery-stats'] });
    queryClient.invalidateQueries({ queryKey: ['problematic-messages'] });
  };

  return (
    <div className="space-y-4">
      {/* Painel de Estatísticas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <span>Status de Entrega - 24h</span>
              </CardTitle>
              <CardDescription>
                Monitoramento em tempo real das entregas do Rodrigo Bot
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['delivery-stats'] });
                queryClient.invalidateQueries({ queryKey: ['problematic-messages'] });
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {deliveryStats?.total || 0}
              </div>
              <div className="text-sm text-gray-600">Total Enviadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {deliveryStats?.delivered || 0}
              </div>
              <div className="text-sm text-gray-600">Entregues</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {deliveryStats?.pending || 0}
              </div>
              <div className="text-sm text-gray-600">Pendentes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {deliveryStats?.failed || 0}
              </div>
              <div className="text-sm text-gray-600">Falharam</div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Taxa de Entrega:</span>
              <Badge 
                variant={deliveryStats?.deliveryRate >= 90 ? "default" : 
                        deliveryStats?.deliveryRate >= 70 ? "secondary" : "destructive"}
                className={
                  deliveryStats?.deliveryRate >= 90 ? "text-green-600 bg-green-50" : 
                  deliveryStats?.deliveryRate >= 70 ? "text-orange-600 bg-orange-50" : ""
                }
              >
                {deliveryStats?.deliveryRate || 0}%
              </Badge>
            </div>
            
            {(deliveryStats?.pending || 0) > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetryAll}
                disabled={isLoading}
              >
                <Send className="w-4 h-4 mr-2" />
                Reenviar Pendentes
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mensagens Problemáticas */}
      {problematicMessages && problematicMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span>Mensagens Problemáticas (2h)</span>
            </CardTitle>
            <CardDescription>
              Mensagens que podem precisar de atenção
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {problematicMessages.map((message) => (
                <div
                  key={message.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium">
                        {message.sellers?.name || 'Vendedor'}
                      </span>
                      <Badge 
                        variant={message.status === 'failed' ? "destructive" : "secondary"}
                        className={message.status !== 'failed' ? "text-orange-600 bg-orange-50" : ""}
                      >
                        {message.status === 'sent' ? 'Pendente' : 
                         message.status === 'pending' ? 'Pendente' : 
                         message.status === 'failed' ? 'Falhou' : message.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span>Para: {message.phone_to}</span>
                      <span className="ml-4">
                        {new Date(message.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {message.status === 'failed' ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-orange-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
