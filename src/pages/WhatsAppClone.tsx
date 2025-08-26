import { useState } from "react";
import { Search, MoreVertical, MessageSquare, Phone, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useWhapiConversations, WhapiConversation } from "@/hooks/useWhapiConversations";
import { useWhapiMessages } from "@/hooks/useWhapiMessages";
import { MessageBubble } from "@/components/WhatsApp/MessageBubble";
import { SyncHistoryDialog } from "@/components/WhatsAppClone/SyncHistoryDialog";
import { toast } from "sonner";

export default function WhatsAppClone() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  const { data: conversations = [], refetch: refetchConversations, isLoading: conversationsLoading } = useWhapiConversations(searchTerm);
  const { data: messages = [], isLoading: messagesLoading } = useWhapiMessages(selectedConversationId);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

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

  const getSellerColor = (sellerName?: string) => {
    if (!sellerName) return 'bg-muted';
    const colors = [
      'bg-emerald-500',
      'bg-blue-500', 
      'bg-purple-500',
      'bg-orange-500',
      'bg-rose-500',
      'bg-teal-500'
    ];
    const index = sellerName.length % colors.length;
    return colors[index];
  };

  const handleRefresh = () => {
    refetchConversations();
    toast.success("Conversas dos vendedores atualizadas");
  };

  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Lista de Conversas dos Vendedores */}
      <div className="w-80 border-r border-border bg-card">
        {/* Header da Lista */}
        <div className="p-4 bg-muted/30 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Atendimentos Vendedores
            </h1>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={handleRefresh}>
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSyncDialog(true)}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Barra de Pesquisa */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>
        </div>

        {/* Lista de Conversas */}
        <ScrollArea className="h-[calc(100vh-140px)]">
          {conversationsLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando conversas...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma conversa de vendedor encontrada</p>
              <p className="text-xs text-muted-foreground mt-2">Clique em "Sincronizar" para buscar conversas</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                    selectedConversationId === conversation.id && "bg-primary/10 border-r-2 border-primary"
                  )}
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar do Cliente */}
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {getInitials(conversation.customer_name || conversation.phone_number)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium truncate text-foreground">
                          {conversation.customer_name || formatPhone(conversation.phone_number)}
                        </h3>
                        <div className="flex items-center gap-1">
                          {conversation.last_message_at && (
                            <span className="text-xs text-muted-foreground">
                              {formatTime(conversation.last_message_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Vendedor Responsável */}
                      {conversation.seller_name && (
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn("w-2 h-2 rounded-full", getSellerColor(conversation.seller_name))}></div>
                          <span className="text-xs text-muted-foreground">
                            {conversation.seller_name}
                          </span>
                        </div>
                      )}

                      {/* Telefone se nome está presente */}
                      {conversation.customer_name && (
                        <p className="text-xs text-muted-foreground mb-1">
                          {formatPhone(conversation.phone_number)}
                        </p>
                      )}

                      {/* Preview da última mensagem */}
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate flex-1">
                          {conversation.last_sender_type === 'customer' && '📱 '}
                          {conversation.last_sender_type === 'seller' && '💼 '}
                          {conversation.last_message || 'Sem mensagens'}
                        </p>
                        
                        {/* Badges de status */}
                        <div className="flex items-center gap-1">
                          {conversation.unread_count > 0 && (
                            <Badge variant="default" className="bg-primary text-primary-foreground text-xs px-2 py-0">
                              {conversation.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Área Principal - Chat do Vendedor */}
      <div className="flex-1 flex flex-col bg-muted/20">
        {selectedConversation ? (
          <>
            {/* Header do Chat */}
            <div className="p-4 bg-card border-b border-border">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(selectedConversation.customer_name || selectedConversation.phone_number)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <h2 className="font-semibold text-foreground">
                    {selectedConversation.customer_name || formatPhone(selectedConversation.phone_number)}
                  </h2>
                  <div className="flex items-center gap-2">
                    {selectedConversation.customer_name && (
                      <span className="text-sm text-muted-foreground">
                        {formatPhone(selectedConversation.phone_number)}
                      </span>
                    )}
                    {selectedConversation.seller_name && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <div className="flex items-center gap-1">
                          <div className={cn("w-2 h-2 rounded-full", getSellerColor(selectedConversation.seller_name))}></div>
                          <span className="text-sm text-muted-foreground">
                            Vendedor: {selectedConversation.seller_name}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Área de Mensagens */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Carregando mensagens...</p>
                  </div>
                </div>
              ) : sortedMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p>Nenhuma mensagem encontrada</p>
                    <p className="text-sm mt-1">As mensagens aparecerão aqui em tempo real</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-4xl mx-auto">
                  {sortedMessages.map((message, index) => {
                    const showDateSeparator = index === 0 || 
                      format(new Date(message.created_at), 'yyyy-MM-dd') !== 
                      format(new Date(sortedMessages[index - 1].created_at), 'yyyy-MM-dd');

                    return (
                      <div key={message.id}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-6">
                            <div className="bg-card px-3 py-1 rounded-full text-xs text-muted-foreground border border-border">
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

            {/* Footer com informações */}
            <div className="p-3 bg-card border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>📊 {messages.length} mensagens</span>
                  {selectedConversation.total_messages > 0 && (
                    <span>💬 {selectedConversation.total_messages} total</span>
                  )}
                </div>
                {selectedConversation.last_message_at && (
                  <div>
                    Última atividade: {format(new Date(selectedConversation.last_message_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2 text-foreground">
                Acompanhe os Atendimentos
              </h2>
              <p className="text-muted-foreground max-w-md">
                Selecione uma conversa à esquerda para monitorar o atendimento entre vendedores e clientes
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dialog de Sincronização */}
      <SyncHistoryDialog
        open={showSyncDialog}
        onOpenChange={setShowSyncDialog}
        onSuccess={() => {
          refetchConversations();
          toast.success("Histórico WHAPI sincronizado com sucesso!");
        }}
      />
    </div>
  );
}