import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConversationSummaryDialog } from "@/components/WhatsApp/ConversationSummaryDialog";
import { 
  Search, 
  Filter, 
  Download, 
  Target, 
  Calendar,
  TrendingUp,
  Eye,
  ExternalLink,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLeads, useMarkSale, useLeadStats } from "@/hooks/useLeads";
import { useSellers } from "@/hooks/useSellers";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export default function Leads() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Hooks para dados reais
  const { leads = [], isLoading: leadsLoading } = useLeads();
  const { sellers = [], isLoading: sellersLoading } = useSellers();
  const markSaleMutation = useMarkSale();
  const stats = useLeadStats(leads);


  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.phone_number.includes(searchTerm) ||
                         (lead.product_interest || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesSeller = sellerFilter === 'all' || lead.seller_name === sellerFilter;
    
    let matchesDate = true;
    if (dateFilter !== 'all' && lead.sent_at) {
      const leadDate = new Date(lead.sent_at);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - leadDate.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (dateFilter) {
        case 'today':
          matchesDate = diffDays === 0;
          break;
        case 'week':
          matchesDate = diffDays <= 7;
          break;
        case 'month':
          matchesDate = diffDays <= 30;
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesSeller && matchesDate;
  });


  const handleMarkSale = (leadId: string) => {
    markSaleMutation.mutate({ leadId });
  };

  const handleViewSummary = (conversationId: string | null) => {
    if (conversationId) {
      setSelectedConversationId(conversationId);
      setSummaryDialogOpen(true);
    } else {
      toast({
        title: "Conversa não encontrada",
        description: "Não foi possível encontrar a conversa associada a este lead.",
        variant: "destructive"
      });
    }
  };

  const handleOpenSellerChat = (lead: any) => {
    if (lead.seller_id) {
      // Navegar para a página de mensagens dos vendedores com contexto
      navigate(`/mensagens/vendedores?seller=${lead.seller_id}&customer=${lead.customer_name}`);
    } else {
      toast({
        title: "Vendedor não encontrado",
        description: "Não foi possível encontrar o vendedor associado a este lead.",
        variant: "destructive"
      });
    }
  };

  const getTimeSinceSent = (dateString: string | null) => {
    if (!dateString) return 'Data não disponível';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return `${diffHours}h atrás`;
    } else {
      return `${Math.floor(diffHours / 24)}d atrás`;
    }
  };

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

  if (leadsLoading || sellersLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os leads enviados aos vendedores
          </p>
        </div>
        <Button className="flex items-center space-x-2">
          <Download className="h-4 w-4" />
          <span>Exportar</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Target className="h-8 w-8 text-drystore-orange" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total de Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-8 w-8 text-drystore-success" />
              <div>
                <p className="text-2xl font-bold">{stats.sold}</p>
                <p className="text-sm text-muted-foreground">Vendas Realizadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Eye className="h-8 w-8 text-drystore-info" />
              <div>
                <p className="text-2xl font-bold">{stats.attending}</p>
                <p className="text-sm text-muted-foreground">Em Atendimento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Calendar className="h-8 w-8 text-drystore-warning" />
              <div>
                <p className="text-2xl font-bold">{stats.conversionRate}%</p>
                <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-8 w-8 text-drystore-success" />
              <div>
                <p className="text-2xl font-bold">R$ {(stats.totalValue / 1000).toFixed(0)}k</p>
                <p className="text-sm text-muted-foreground">Valor Total Vendido</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Target className="h-8 w-8 text-drystore-info" />
              <div>
                <p className="text-2xl font-bold">R$ {(stats.avgTicket / 1000).toFixed(0)}k</p>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-drystore-orange" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, telefone ou produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="attending">Atendendo</SelectItem>
                <SelectItem value="finished">Finalizado</SelectItem>
                <SelectItem value="sold">Vendido</SelectItem>
                <SelectItem value="lost">Perdido</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sellerFilter} onValueChange={setSellerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Vendedores</SelectItem>
                {(sellers || []).map(seller => (
                  <SelectItem key={seller.id} value={seller.name}>{seller.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Períodos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Lista de Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Produto/Resumo</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead>Valor Venda</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(filteredLeads || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="text-center">
                      <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {leads.length === 0 
                          ? "Nenhum lead encontrado. Leads aparecerão aqui quando forem transferidos para vendedores."
                          : "Nenhum lead corresponde aos filtros aplicados."
                        }
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                (filteredLeads || []).map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <button 
                          onClick={() => handleOpenSellerChat(lead)}
                          className="font-medium text-drystore-orange hover:underline cursor-pointer"
                        >
                          {lead.customer_name}
                        </button>
                        {lead.generated_sale && (
                          <span className="text-xs bg-drystore-success/10 text-drystore-success px-2 py-1 rounded block mt-1">
                            Venda realizada
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{lead.phone_number}</TableCell>
                    <TableCell>{lead.seller_name || 'Não atribuído'}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{lead.product_interest || 'Não especificado'}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {lead.summary || 'Sem resumo disponível'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{getTimeSinceSent(lead.sent_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {lead.sale_value 
                          ? `R$ ${(lead.sale_value / 1000).toFixed(0)}k` 
                          : 'Não informado'
                        }
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={(lead.status || 'unknown') as any} />
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleViewSummary(lead.conversation_id)}
                          title="Ver resumo da conversa"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleOpenSellerChat(lead)}
                          title="Abrir conversa com vendedor"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {lead.status === 'attending' && !lead.generated_sale && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleMarkSale(lead.id)}
                            className="text-drystore-success hover:bg-drystore-success/10"
                            title="Marcar como venda"
                            disabled={markSaleMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Resumo da Conversa */}
      <ConversationSummaryDialog
        open={summaryDialogOpen}
        onOpenChange={setSummaryDialogOpen}
        conversationId={selectedConversationId}
      />
    </div>
  );
}