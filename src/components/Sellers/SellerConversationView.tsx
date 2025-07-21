
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessagePanel } from "@/components/WhatsApp/MessagePanel";
import { useConversationMessages } from "@/hooks/useConversationMessages";
import { User, Phone, Clock, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SellerConversationViewProps {
  conversationId: string;
  conversation?: {
    customer_name: string;
    phone_number: string;
    status: string;
    seller_name: string;
    last_message_at: string;
    total_messages: number;
  };
}

export function SellerConversationView({ 
  conversationId, 
  conversation 
}: SellerConversationViewProps) {
  const { data: messages, isLoading } = useConversationMessages(conversationId);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'bot_attending':
        return <Badge variant="secondary">Bot Atendendo</Badge>;
      case 'sent_to_seller':
        return <Badge variant="default">Com Vendedor</Badge>;
      case 'finished':
        return <Badge variant="outline">Finalizada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!conversation) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecione uma conversa para visualizar as mensagens</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>{conversation.customer_name}</span>
          </CardTitle>
          {getStatusBadge(conversation.status)}
        </div>
        
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center space-x-2">
            <Phone className="h-4 w-4" />
            <span>{conversation.phone_number}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>Vendedor: {conversation.seller_name}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>
                Última atividade: {formatDistanceToNow(new Date(conversation.last_message_at), {
                  addSuffix: true,
                  locale: ptBR
                })}
              </span>
            </div>
            <span>{conversation.total_messages} mensagens</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <MessagePanel
            conversation_id={conversationId}
            messages={messages || []}
            canSendMessage={false}
            className="h-full"
          />
        )}
      </CardContent>
    </Card>
  );
}
