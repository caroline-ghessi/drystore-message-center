import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MessageSquare, Phone, User } from "lucide-react";

interface ConversationSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
}

export function ConversationSummaryDialog({
  open,
  onOpenChange,
  conversationId
}: ConversationSummaryDialogProps) {
  const { data: history, isLoading, error } = useConversationHistory(conversationId);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Data não disponível';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Carregando resumo da conversa...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !history) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Erro ao carregar conversa</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Não foi possível carregar o histórico da conversa.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-drystore-orange" />
            <span>Resumo da Conversa</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações da Conversa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-drystore-orange" />
                <span className="font-medium">Cliente:</span>
                <span>{history.conversation.customer_name || 'Nome não disponível'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-drystore-orange" />
                <span className="font-medium">Telefone:</span>
                <span>{history.conversation.phone_number}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-drystore-orange" />
                <span className="font-medium">Iniciada em:</span>
                <span>{formatDate(history.conversation.created_at)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 text-drystore-orange" />
                <span className="font-medium">Total de mensagens:</span>
                <Badge variant="secondary">{history.totalMessages}</Badge>
              </div>
            </div>
          </div>

          {/* Histórico de Mensagens */}
          <div className="space-y-4">
            <h3 className="font-semibold">Histórico de Mensagens</h3>
            <ScrollArea className="h-[400px] border rounded-lg p-4">
              {history.messages.length > 0 ? (
                <div className="space-y-4">
                  {history.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      content={message.content || ''}
                      sender_type={message.sender_type as 'customer' | 'bot' | 'seller' | 'system'}
                      sender_name={message.sender_name || 'Usuário'}
                      message_type={message.message_type as 'text' | 'image' | 'audio' | 'video' | 'document' | 'location'}
                      media_url={message.media_url || undefined}
                      created_at={message.created_at || new Date().toISOString()}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma mensagem encontrada nesta conversa.
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}