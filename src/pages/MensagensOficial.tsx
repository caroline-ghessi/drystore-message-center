import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessagePanel } from "@/components/WhatsApp/MessagePanel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Search, Phone, Clock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  phone_number: string;
  customer_name: string;
  status: 'bot_attending' | 'waiting_evaluation' | 'sent_to_seller' | 'finished';
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

export default function MensagensOficial() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  // Mock data - substituir por dados reais do Supabase
  const conversations: Conversation[] = [
    {
      id: '1',
      phone_number: '(11) 99999-9999',
      customer_name: 'João Silva',
      status: 'bot_attending',
      last_message: 'Gostaria de saber sobre o produto X',
      last_message_time: '2024-01-15T10:30:00Z',
      unread_count: 2
    },
    {
      id: '2',
      phone_number: '(11) 88888-8888',
      customer_name: 'Maria Santos',
      status: 'waiting_evaluation',
      last_message: 'Preciso de mais informações sobre preços',
      last_message_time: '2024-01-15T10:25:00Z',
      unread_count: 0
    },
    {
      id: '3',
      phone_number: '(11) 77777-7777',
      customer_name: 'Pedro Costa',
      status: 'sent_to_seller',
      last_message: 'Obrigado pela informação',
      last_message_time: '2024-01-15T10:20:00Z',
      unread_count: 1
    }
  ];

  const mockMessages = [
    {
      id: '1',
      conversation_id: selectedConversation || '1',
      sender_type: 'customer' as const,
      sender_name: 'João Silva',
      content: 'Olá! Gostaria de saber sobre o produto X',
      message_type: 'text' as const,
      created_at: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      conversation_id: selectedConversation || '1',
      sender_type: 'bot' as const,
      sender_name: 'Assistente Drystore',
      content: 'Olá! Posso ajudar você com informações sobre nossos produtos. Sobre qual produto específico você gostaria de saber?',
      message_type: 'text' as const,
      created_at: '2024-01-15T10:30:30Z'
    },
    {
      id: '3',
      conversation_id: selectedConversation || '1',
      sender_type: 'customer' as const,
      sender_name: 'João Silva',
      content: 'Estou interessado em produtos para secagem industrial',
      message_type: 'text' as const,
      created_at: '2024-01-15T10:31:00Z'
    }
  ];

  const filteredConversations = conversations.filter(conv =>
    conv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.phone_number.includes(searchTerm)
  );

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
              {filteredConversations.map((conversation) => (
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
                        {conversation.last_message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <StatusBadge status={conversation.status} />
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatTime(conversation.last_message_time)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
                    <StatusBadge 
                      status={conversations.find(c => c.id === selectedConversation)?.status || 'bot_attending'} 
                    />
                  </div>
                ) : (
                  'Selecione uma conversa'
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100vh-350px)]">
              {selectedConversation ? (
                <MessagePanel
                  conversation_id={selectedConversation}
                  messages={mockMessages}
                  canSendMessage={false}
                  className="h-full"
                />
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