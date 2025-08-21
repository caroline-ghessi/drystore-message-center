import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw, Clock, Bot, User, MessageSquare } from "lucide-react";

interface ConversationStatus {
  id: string;
  phone_number: string;
  customer_name: string;
  status: string;
  fallback_mode: boolean;
  updated_at: string;
  created_at: string;
  last_message?: string;
  last_message_at?: string;
  total_messages: number;
  pending_queue_messages: number;
}

export function ConversationStatusMonitor() {
  // Busca status das conversas
  const { data: conversations, isLoading, refetch } = useQuery({
    queryKey: ['conversation-status-monitor'],
    queryFn: async () => {
      // Busca conversas ativas com informações de fila
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          phone_number,
          customer_name,
          status,
          fallback_mode,
          updated_at,
          created_at
        `)
        .in('status', ['bot_attending', 'transferred_to_seller', 'finished'])
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Para cada conversa, busca informações adicionais
      const enrichedConversations = await Promise.all(
        data.map(async (conv) => {
          // Busca última mensagem
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Conta total de mensagens
          const { count: totalMessages } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id);

          // Conta mensagens pendentes na fila
          const { count: pendingQueue } = await supabase
            .from('message_queue')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('status', 'waiting');

          return {
            ...conv,
            last_message: lastMessage?.content || 'Nenhuma mensagem',
            last_message_at: lastMessage?.created_at,
            total_messages: totalMessages || 0,
            pending_queue_messages: pendingQueue || 0
          };
        })
      );

      return enrichedConversations as ConversationStatus[];
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  // Busca estatísticas gerais
  const { data: stats } = useQuery({
    queryKey: ['conversation-status-stats'],
    queryFn: async () => {
      const { data: botAttending } = await supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'bot_attending')
        .eq('fallback_mode', false);

      const { data: fallbackMode } = await supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('fallback_mode', true);

      const { data: transferred } = await supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'transferred_to_seller');

      const { data: finished } = await supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'finished');

      const { data: pendingQueue } = await supabase
        .from('message_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'waiting');

      return {
        bot_attending: botAttending?.length || 0,
        fallback_mode: fallbackMode?.length || 0,
        transferred_to_seller: transferred?.length || 0,
        finished: finished?.length || 0,
        pending_queue: pendingQueue?.length || 0
      };
    },
    refetchInterval: 3000,
  });

  const handleCheckInactive = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-inactive-conversations');
      
      if (error) throw error;

      toast.success(`Verificação concluída: ${data.processed} conversas processadas`);
      refetch();
    } catch (error) {
      console.error('Erro ao verificar conversas inativas:', error);
      toast.error('Erro ao verificar conversas inativas');
    }
  };

  const getStatusBadge = (status: string, fallbackMode: boolean) => {
    if (fallbackMode) {
      return <Badge variant="destructive">Fallback</Badge>;
    }

    switch (status) {
      case 'bot_attending':
        return <Badge className="bg-blue-500">Bot Atendendo</Badge>;
      case 'transferred_to_seller':
        return <Badge className="bg-green-500">Com Vendedor</Badge>;
      case 'finished':
        return <Badge variant="secondary">Finalizada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Agora';
    if (diffMinutes < 60) return `${diffMinutes}min atrás`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h atrás`;
    return `${Math.floor(diffMinutes / 1440)}d atrás`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Monitor de Status das Conversas
        </CardTitle>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCheckInactive}
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Verificar Inativas
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Estatísticas */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <Bot className="h-6 w-6 mx-auto mb-1 text-blue-500" />
              <div className="text-2xl font-bold text-blue-600">{stats.bot_attending}</div>
              <div className="text-sm text-blue-600">Bot Atendendo</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.fallback_mode}</div>
              <div className="text-sm text-red-600">Fallback</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <User className="h-6 w-6 mx-auto mb-1 text-green-500" />
              <div className="text-2xl font-bold text-green-600">{stats.transferred_to_seller}</div>
              <div className="text-sm text-green-600">Com Vendedor</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{stats.finished}</div>
              <div className="text-sm text-gray-600">Finalizadas</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <Clock className="h-6 w-6 mx-auto mb-1 text-yellow-500" />
              <div className="text-2xl font-bold text-yellow-600">{stats.pending_queue}</div>
              <div className="text-sm text-yellow-600">Na Fila</div>
            </div>
          </div>
        )}

        {/* Lista de conversas */}
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : conversations && conversations.length > 0 ? (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <div key={conv.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">
                      {conv.customer_name || 'Cliente WhatsApp'}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {conv.phone_number}
                    </Badge>
                    {getStatusBadge(conv.status, conv.fallback_mode)}
                    {conv.pending_queue_messages > 0 && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        {conv.pending_queue_messages} na fila
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatTime(conv.updated_at)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground">
                    Última mensagem: {conv.last_message?.substring(0, 50)}
                    {(conv.last_message?.length || 0) > 50 ? '...' : ''}
                  </div>
                  <div className="text-muted-foreground">
                    {conv.total_messages} mensagens
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Nenhuma conversa ativa encontrada
          </div>
        )}
      </CardContent>
    </Card>
  );
}