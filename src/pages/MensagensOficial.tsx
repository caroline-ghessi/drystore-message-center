import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessagePanel } from "@/components/WhatsApp/MessagePanel";
import { StatusBadge } from "@/components/ui/status-badge";
import { TransferToSellerDialog } from "@/components/WhatsApp/TransferToSellerDialog";
import { Search, Phone, Clock, MessageSquare, User, AlertTriangle, Timer, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useActiveSellers, useTransferToSeller } from "@/hooks/useSellers";
import { useConversations, Conversation } from "@/hooks/useConversations";
import { useConversationMessages } from "@/hooks/useConversationMessages";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function MensagensOficial() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [timers, setTimers] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Hooks para dados reais
  const { data: conversations = [], isLoading: conversationsLoading } = useConversations(searchTerm);
  const { data: messages = [], isLoading: messagesLoading } = useConversationMessages(selectedConversation);
  const { data: sellers = [], isLoading: sellersLoading } = useActiveSellers();
  const transferMutation = useTransferToSeller();

  // Timer para avaliação automática (simulado por enquanto)
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const newTimers = { ...prev };
        conversations.forEach(conv => {
          if (conv.status === 'waiting_evaluation') {
            // Simula timer de 15 minutos para avaliação
            const timerId = `${conv.id}-timer`;
            if (!newTimers[timerId]) {
              newTimers[timerId] = 15 * 60; // 15 minutos em segundos
            }
            newTimers[timerId] = newTimers[timerId] - 1;
            
            if (newTimers[timerId] <= 0) {
              handleAutoEvaluation(conv.id);
              delete newTimers[timerId];
            }
          }
        });
        return newTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [conversations]);

  const handleAutoEvaluation = async (conversationId: string) => {
    console.log('Avaliação automática disparada para:', conversationId);
    
    try {
      // Atualiza status da conversa no banco
      const { error } = await supabase
        .from('conversations')
        .update({ status: 'sent_to_seller' })
        .eq('id', conversationId);

      if (error) throw error;
      
      toast({
        title: "Avaliação Automática",
        description: "Lead avaliado automaticamente e enviado ao vendedor",
      });
    } catch (error) {
      console.error('Erro na avaliação automática:', error);
      toast({
        title: "Erro",
        description: "Erro na avaliação automática. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleFallbackMode = async (conversationId: string) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para assumir uma conversa.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          fallback_mode: true, 
          status: 'sent_to_seller',
          fallback_taken_by: user.id
        })
        .eq('id', conversationId);

      if (error) throw error;
      
      toast({
        title: "Modo Fallback Ativado",
        description: "Você assumiu o controle desta conversa. O bot foi desativado.",
      });
    } catch (error) {
      console.error('Erro ao ativar fallback:', error);
      toast({
        title: "Erro",
        description: "Erro ao assumir conversa. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min atrás`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} h atrás`;
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTransferToSeller = async (sellerId: string, notes?: string) => {
    if (!selectedConversation) return;
    
    const conversation = conversations.find(c => c.id === selectedConversation);
    if (!conversation) return;

    await transferMutation.mutateAsync({
      conversationId: selectedConversation,
      sellerId,
      customerName: conversation.customer_name,
      phoneNumber: conversation.phone_number,
      notes,
    });
  };

  return (
    <div className="p-6 h-screen flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Mensagens WhatsApp Oficial</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe as conversas do canal oficial
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-drystore-orange" />
              <span>Conversas</span>
            </CardTitle>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
              {conversationsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Carregando conversas...</span>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
                  </div>
                </div>
              ) : (
                conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation.id)}
                  className={cn(
                    "p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                    selectedConversation === conversation.id && "bg-muted"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium truncate">{conversation.customer_name}</h3>
                        {conversation.unread_count > 0 && (
                          <span className="bg-drystore-orange text-white text-xs px-2 py-1 rounded-full">
                            {conversation.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground mt-1">
                        <Phone className="h-3 w-3" />
                        <span>{conversation.phone_number}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {conversation.last_message || 'Sem mensagens'}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <StatusBadge status={conversation.status} />
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatTime(conversation.last_message_at)}</span>
                          {conversation.status === 'waiting_evaluation' && timers[`${conversation.id}-timer`] && (
                            <div className="flex items-center space-x-1 text-drystore-warning">
                              <Timer className="h-3 w-3" />
                              <span>{formatTimer(timers[`${conversation.id}-timer`])}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Message Panel */}
        <div className="lg:col-span-2">
          <Card className="shadow-card h-full">
            <CardHeader className="pb-3">
              <CardTitle>
                {selectedConversation ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <span>{conversations.find(c => c.id === selectedConversation)?.customer_name}</span>
                      <div className="text-sm text-muted-foreground font-normal">
                        {conversations.find(c => c.id === selectedConversation)?.phone_number}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <StatusBadge 
                        status={conversations.find(c => c.id === selectedConversation)?.status || 'bot_attending'} 
                      />
                      {/* Botões de Ação */}
                      {selectedConversation && (
                        <div className="flex items-center space-x-2">
                          {/* Botão Transferir - apenas em modo fallback */}
                          {conversations.find(c => c.id === selectedConversation)?.fallback_mode && (
                            <TransferToSellerDialog
                              conversationId={selectedConversation}
                              customerName={conversations.find(c => c.id === selectedConversation)?.customer_name || ''}
                              sellers={sellers}
                              isLoading={sellersLoading}
                              onTransfer={handleTransferToSeller}
                            />
                          )}
                          
                          {/* Botão Fallback - apenas se não estiver em fallback */}
                          {!conversations.find(c => c.id === selectedConversation)?.fallback_mode && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="flex items-center space-x-1">
                                  <User className="h-3 w-3" />
                                  <span>Assumir Conversa</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center space-x-2">
                                    <AlertTriangle className="h-5 w-5 text-drystore-warning" />
                                    <span>Ativar Modo Fallback</span>
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Ao assumir esta conversa, o bot Dify será desativado e você assumirá o controle total. 
                                    Esta ação não pode ser desfeita. Deseja continuar?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleFallbackMode(selectedConversation)}>
                                    Assumir Conversa
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  'Selecione uma conversa'
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100vh-350px)]">
              {selectedConversation ? (
                messagesLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">Carregando mensagens...</p>
                    </div>
                  </div>
                ) : (
                  <MessagePanel
                    conversation_id={selectedConversation}
                    messages={messages}
                    canSendMessage={conversations.find(c => c.id === selectedConversation)?.fallback_mode || false}
                    className="h-full"
                  />
                )
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Selecione uma conversa para visualizar as mensagens
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}