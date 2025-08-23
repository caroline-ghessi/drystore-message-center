import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, Search, AlertTriangle } from 'lucide-react';

interface UnsentMessage {
  id: string;
  content: string;
  created_at: string;
  metadata?: any;
}

interface ConversationWithUnsentMessages {
  conversation: {
    id: string;
    phone_number: string;
    customer_name: string;
    status: string;
  };
  unsent_messages: UnsentMessage[];
}

interface CheckResult {
  conversations_with_unsent_messages: number;
  total_unsent_messages: number;
  pending_queue_messages: number;
  results: ConversationWithUnsentMessages[];
  queue_messages?: any[];
}

export const BotMessageTester = () => {
  const [isForcing, setIsForcing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  
  const { toast } = useToast();

  const forceCarolineProcessing = async () => {
    setIsForcing(true);
    try {
      const { data, error } = await supabase.functions.invoke('force-process-caroline');
      
      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: "✅ Sucesso!",
          description: "Mensagem da Caroline reenviada com sucesso",
          duration: 5000,
        });
      } else {
        throw new Error(data?.error || 'Falha desconhecida');
      }
    } catch (error: any) {
      console.error('Error forcing Caroline processing:', error);
      toast({
        title: "❌ Erro",
        description: `Erro ao reenviar mensagem: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsForcing(false);
    }
  };

  const checkPendingMessages = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-pending-bot-messages');
      
      if (error) {
        throw error;
      }

      if (data?.success) {
        setCheckResult(data.summary);
        toast({
          title: "✅ Verificação concluída",
          description: `Encontradas ${data.summary?.total_unsent_messages || 0} mensagens não enviadas`,
        });
      } else {
        throw new Error(data?.error || 'Falha na verificação');
      }
    } catch (error: any) {
      console.error('Error checking pending messages:', error);
      toast({
        title: "❌ Erro",
        description: `Erro na verificação: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Teste de Mensagens do Bot
          </CardTitle>
          <CardDescription>
            Ferramentas para diagnosticar e corrigir problemas de envio de mensagens do bot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={forceCarolineProcessing}
              disabled={isForcing}
              className="h-auto p-4 flex flex-col items-center gap-2"
              variant="outline"
            >
              {isForcing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              <div className="text-center">
                <div className="font-medium">Reenviar para Caroline</div>
                <div className="text-sm text-muted-foreground">
                  Força o reenvio da mensagem do bot para Caroline Ghessi
                </div>
              </div>
            </Button>

            <Button
              onClick={checkPendingMessages}
              disabled={isChecking}
              className="h-auto p-4 flex flex-col items-center gap-2"
              variant="outline"
            >
              {isChecking ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
              <div className="text-center">
                <div className="font-medium">Verificar Pendências</div>
                <div className="text-sm text-muted-foreground">
                  Busca mensagens do bot que não foram enviadas
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {checkResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Resultado da Verificação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {checkResult.conversations_with_unsent_messages}
                </div>
                <div className="text-sm text-muted-foreground">
                  Conversas com mensagens não enviadas
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {checkResult.total_unsent_messages}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total de mensagens não enviadas
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {checkResult.pending_queue_messages}
                </div>
                <div className="text-sm text-muted-foreground">
                  Mensagens na fila
                </div>
              </div>
            </div>

            {checkResult.results.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">Conversas com Problemas:</h3>
                {checkResult.results.map((result, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {result.conversation.customer_name || result.conversation.phone_number}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ID: {result.conversation.id}
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {result.unsent_messages.length} não enviadas
                      </Badge>
                    </div>
                    
                    <div className="mt-3 space-y-2">
                      {result.unsent_messages.map((message, msgIndex) => (
                        <div key={msgIndex} className="bg-muted p-2 rounded text-sm">
                          <div className="font-medium">Mensagem #{msgIndex + 1}</div>
                          <div className="text-muted-foreground">
                            {message.content}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(message.created_at).toLocaleString('pt-BR')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {checkResult.total_unsent_messages === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                ✅ Nenhuma mensagem pendente encontrada. Todas as mensagens do bot foram enviadas corretamente!
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};