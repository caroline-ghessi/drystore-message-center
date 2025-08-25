import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/WhatsApp/MessageBubble";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/hooks/useConversations";
import type { Message } from "@/hooks/useConversationMessages";

interface MessageViewerProps {
  conversation: Conversation;
  messages: Message[];
}

export function MessageViewer({ conversation, messages }: MessageViewerProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[parts.length - 1][0];
    }
    return name[0].toUpperCase();
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
      const number = cleanPhone.substring(2);
      return `+55 (${number.substring(0, 2)}) ${number.substring(2, 7)}-${number.substring(7)}`;
    } else if (cleanPhone.length === 11) {
      return `(${cleanPhone.substring(0, 2)}) ${cleanPhone.substring(2, 7)}-${cleanPhone.substring(7)}`;
    }
    
    return phone;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'bot_attending':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'sent_to_seller':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'finished':
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
      default:
        return 'bg-orange-500/10 text-orange-700 border-orange-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'bot_attending':
        return 'Atendimento Bot';
      case 'sent_to_seller':
        return 'Com Vendedor';
      case 'finished':
        return 'Finalizada';
      default:
        return status;
    }
  };

  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header da Conversa */}
      <div className="p-4 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(conversation.customer_name || conversation.phone_number)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <h2 className="font-semibold">
              {conversation.customer_name || formatPhone(conversation.phone_number)}
            </h2>
            {conversation.customer_name && (
              <p className="text-sm text-muted-foreground">
                {formatPhone(conversation.phone_number)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={getStatusColor(conversation.status || 'unknown')}
            >
              {getStatusText(conversation.status || 'unknown')}
            </Badge>
            
            <div className="text-sm text-muted-foreground text-right">
              {messages.length} mensagen{messages.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Área de Mensagens */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        {sortedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p>Nenhuma mensagem encontrada</p>
              <p className="text-sm mt-1">As mensagens aparecerão aqui em tempo real</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedMessages.map((message, index) => {
              const showDateSeparator = index === 0 || 
                format(new Date(message.created_at), 'yyyy-MM-dd') !== 
                format(new Date(sortedMessages[index - 1].created_at), 'yyyy-MM-dd');

              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="flex items-center justify-center my-4">
                      <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                        {format(new Date(message.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </div>
                    </div>
                  )}
                  
                  <MessageBubble 
                    content={message.content || ''}
                    sender_type={message.sender_type}
                    sender_name={message.sender_name || ''}
                    message_type={message.message_type}
                    media_url={message.media_url}
                    created_at={message.created_at}
                    metadata={message.metadata}
                  />
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer com informações da conversa */}
      <div className="p-3 bg-muted/30 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Criada em {format(new Date(conversation.created_at || new Date()), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
          {conversation.last_message_at && (
            <div>
              Última atividade: {format(new Date(conversation.last_message_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}