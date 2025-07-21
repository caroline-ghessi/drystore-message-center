
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MessageCircle, Clock, User } from "lucide-react";
import { SellerConversation } from "@/hooks/useSellerConversations";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SellerConversationsListProps {
  conversations: SellerConversation[];
  selectedConversation?: string;
  onSelectConversation: (conversationId: string) => void;
  onSellerFilter: (sellerId: string) => void;
  onStatusFilter: (status: string) => void;
  sellers: Array<{ id: string; name: string }>;
}

export function SellerConversationsList({
  conversations,
  selectedConversation,
  onSelectConversation,
  onSellerFilter,
  onStatusFilter,
  sellers
}: SellerConversationsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeller, setSelectedSeller] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = 
      conv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.phone_number.includes(searchTerm) ||
      conv.last_message.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

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

  const handleSellerChange = (sellerId: string) => {
    setSelectedSeller(sellerId);
    onSellerFilter(sellerId);
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    onStatusFilter(status);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MessageCircle className="h-5 w-5" />
          <span>Conversas dos Vendedores</span>
        </CardTitle>
        
        <div className="space-y-2">
          {/* Barra de pesquisa */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, telefone ou mensagem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          {/* Filtros */}
          <div className="flex space-x-2">
            <Select value={selectedSeller} onValueChange={handleSellerChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os vendedores</SelectItem>
                {sellers.map((seller) => (
                  <SelectItem key={seller.id} value={seller.id}>
                    {seller.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os status</SelectItem>
                <SelectItem value="sent_to_seller">Com Vendedor</SelectItem>
                <SelectItem value="finished">Finalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                  selectedConversation === conversation.id ? 'bg-muted' : ''
                }`}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium">{conversation.customer_name}</h3>
                    {conversation.unread_count > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {conversation.unread_count}
                      </Badge>
                    )}
                  </div>
                  {getStatusBadge(conversation.status)}
                </div>
                
                <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
                  <User className="h-3 w-3" />
                  <span>{conversation.seller_name}</span>
                  <span>•</span>
                  <span>{conversation.phone_number}</span>
                </div>
                
                <p className="text-sm text-muted-foreground truncate mb-2">
                  {conversation.last_message}
                </p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {formatDistanceToNow(new Date(conversation.last_message_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </span>
                  </div>
                  <span>{conversation.total_messages} mensagens</span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
