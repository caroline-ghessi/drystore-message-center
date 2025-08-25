import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/hooks/useConversations";

interface ConversationsListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationsList({ conversations, selectedId, onSelect }: ConversationsListProps) {
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
        return 'Bot';
      case 'sent_to_seller':
        return 'Vendedor';
      case 'finished':
        return 'Finalizada';
      default:
        return status;
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[parts.length - 1][0];
    }
    return name[0].toUpperCase();
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return format(date, 'HH:mm', { locale: ptBR });
      } else if (diffInHours < 168) { // 7 dias
        return format(date, 'EEE', { locale: ptBR });
      } else {
        return format(date, 'dd/MM', { locale: ptBR });
      }
    } catch {
      return '';
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    // Remover caracteres especiais e espaços
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Formato brasileiro
    if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
      const number = cleanPhone.substring(2);
      return `+55 (${number.substring(0, 2)}) ${number.substring(2, 7)}-${number.substring(7)}`;
    } else if (cleanPhone.length === 11) {
      return `(${cleanPhone.substring(0, 2)}) ${cleanPhone.substring(2, 7)}-${cleanPhone.substring(7)}`;
    }
    
    return phone;
  };

  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Nenhuma conversa encontrada</p>
        <p className="text-sm mt-1">Clique em "Sincronizar" para buscar conversas</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          className={cn(
            "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
            selectedId === conversation.id && "bg-primary/10"
          )}
          onClick={() => onSelect(conversation.id)}
        >
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(conversation.customer_name || conversation.phone_number)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium truncate">
                  {conversation.customer_name || formatPhone(conversation.phone_number)}
                </h3>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", getStatusColor(conversation.status || 'unknown'))}
                  >
                    {getStatusText(conversation.status || 'unknown')}
                  </Badge>
                  {conversation.last_message_at && (
                    <span className="text-xs text-muted-foreground">
                      {formatTime(conversation.last_message_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Telefone se nome está presente */}
              {conversation.customer_name && (
                <p className="text-xs text-muted-foreground mb-1">
                  {formatPhone(conversation.phone_number)}
                </p>
              )}

              {/* Última mensagem */}
              {conversation.last_message && (
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.last_message}
                </p>
              )}

              {/* Mensagens não lidas */}
              {conversation.total_messages && conversation.total_messages > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {conversation.total_messages} mensagen{conversation.total_messages !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}