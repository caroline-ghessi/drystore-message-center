import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessagePanel } from "@/components/WhatsApp/MessagePanel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Search, Phone, Clock, MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface SellerConversation {
  id: string;
  phone_number: string;
  customer_name: string;
  status: 'attending' | 'finished' | 'sold' | 'lost';
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

interface Seller {
  id: string;
  name: string;
  active: boolean;
  conversations: SellerConversation[];
}

export default function MensagensVendedores() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('carlos');

  // Mock data - substituir por dados reais do Supabase
  const sellers: Seller[] = [
    {
      id: 'carlos',
      name: 'Carlos Silva',
      active: true,
      conversations: [
        {
          id: '1',
          phone_number: '(11) 99999-9999',
          customer_name: 'João Silva',
          status: 'attending',
          last_message: 'Perfeito! Quando podemos nos encontrar?',
          last_message_time: '2024-01-15T10:30:00Z',
          unread_count: 1
        },
        {
          id: '2',
          phone_number: '(11) 88888-8888',
          customer_name: 'Maria Santos',
          status: 'sold',
          last_message: 'Obrigada! Vou finalizar a compra.',
          last_message_time: '2024-01-15T09:45:00Z',
          unread_count: 0
        }
      ]
    },
    {
      id: 'ana',
      name: 'Ana Santos',
      active: true,
      conversations: [
        {
          id: '3',
          phone_number: '(11) 77777-7777',
          customer_name: 'Pedro Costa',
          status: 'attending',
          last_message: 'Estou analisando as opções',
          last_message_time: '2024-01-15T10:20:00Z',
          unread_count: 0
        }
      ]
    }
  ];

  const mockMessages = [
    {
      id: '1',
      conversation_id: selectedConversation || '1',
      sender_type: 'customer' as const,
      sender_name: 'João Silva',
      content: 'Olá! Recebi seu contato através do WhatsApp oficial da Drystore',
      message_type: 'text' as const,
      created_at: '2024-01-15T10:25:00Z'
    },
    {
      id: '2',
      conversation_id: selectedConversation || '1',
      sender_type: 'seller' as const,
      sender_name: 'Carlos Silva',
      content: 'Olá João! Que bom falar com você. Vi que você tem interesse em produtos para secagem industrial. Posso ajudar você com algumas opções excelentes!',
      message_type: 'text' as const,
      created_at: '2024-01-15T10:26:00Z'
    },
    {
      id: '3',
      conversation_id: selectedConversation || '1',
      sender_type: 'customer' as const,
      sender_name: 'João Silva',
      content: 'Perfeito! Preciso de uma solução para uma linha de produção média. Quando podemos nos encontrar?',
      message_type: 'text' as const,
      created_at: '2024-01-15T10:30:00Z'
    }
  ];

  const currentSeller = sellers.find(s => s.id === activeTab);
  const filteredConversations = currentSeller?.conversations.filter(conv =>
    conv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.phone_number.includes(searchTerm)
  ) || [];

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
        <h1 className="text-3xl font-bold text-foreground">Acompanhar Vendedores</h1>
        <p className="text-muted-foreground mt-1">
          Monitore as conversas dos vendedores com os leads
        </p>
      </div>

      {/* Content */}
      <div className="flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sellers.map(seller => (
              <TabsTrigger key={seller.id} value={seller.id} className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>{seller.name}</span>
                {seller.active && <div className="h-2 w-2 bg-drystore-success rounded-full" />}
              </TabsTrigger>
            ))}
          </TabsList>

          {sellers.map(seller => (
            <TabsContent key={seller.id} value={seller.id} className="mt-6 h-full">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* Conversations List */}
                <Card className="shadow-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="h-5 w-5 text-drystore-orange" />
                        <span>Conversas</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          seller.active ? "bg-drystore-success" : "bg-drystore-error"
                        )} />
                        <span className="text-sm text-muted-foreground">
                          {seller.active ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </CardTitle>
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar conversas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
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
                              <span>{filteredConversations.find(c => c.id === selectedConversation)?.customer_name}</span>
                              <div className="text-sm text-muted-foreground font-normal">
                                {filteredConversations.find(c => c.id === selectedConversation)?.phone_number}
                              </div>
                            </div>
                            <StatusBadge 
                              status={filteredConversations.find(c => c.id === selectedConversation)?.status || 'attending'} 
                            />
                          </div>
                        ) : (
                          'Selecione uma conversa'
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 h-[calc(100vh-450px)]">
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
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}