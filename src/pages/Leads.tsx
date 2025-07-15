import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
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
  XCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

interface Lead {
  id: string;
  customer_name: string;
  phone_number: string;
  seller_name: string;
  product_interest: string;
  summary: string;
  sent_at: string;
  status: 'attending' | 'finished' | 'sold' | 'lost';
  generated_sale: boolean;
  last_contact: string;
  priority: 'high' | 'medium' | 'low';
  estimated_value: number;
}

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const { toast } = useToast();

  // Mock data - substituir por dados reais do Supabase
  const [leads, setLeads] = useState<Lead[]>([
    {
      id: '1',
      customer_name: 'João Silva',
      phone_number: '(11) 99999-9999',
      seller_name: 'Carlos Silva',
      product_interest: 'Secadores Industriais',
      summary: 'Cliente interessado em linha completa para secagem industrial. Empresa média porte.',
      sent_at: '2024-01-15T10:30:00Z',
      status: 'sold',
      generated_sale: true,
      last_contact: '2024-01-15T14:30:00Z',
      priority: 'high',
      estimated_value: 85000
    },
    {
      id: '2',
      customer_name: 'Maria Santos',
      phone_number: '(11) 88888-8888',
      seller_name: 'Ana Santos',
      product_interest: 'Câmaras de Secagem',
      summary: 'Necessita de solução para pequeno negócio de alimentos desidratados.',
      sent_at: '2024-01-15T09:45:00Z',
      status: 'attending',
      generated_sale: false,
      last_contact: '2024-01-15T16:20:00Z',
      priority: 'medium',
      estimated_value: 35000
    },
    {
      id: '3',
      customer_name: 'Pedro Costa',
      phone_number: '(11) 77777-7777',
      seller_name: 'Carlos Silva',
      product_interest: 'Estufas Profissionais',
      summary: 'Interessado em equipamentos para padaria industrial.',
      sent_at: '2024-01-15T08:20:00Z',
      status: 'finished',
      generated_sale: false,
      last_contact: '2024-01-15T12:45:00Z',
      priority: 'low',
      estimated_value: 25000
    },
    {
      id: '4',
      customer_name: 'Ana Oliveira',
      phone_number: '(11) 66666-6666',
      seller_name: 'João Costa',
      product_interest: 'Fornos de Secagem',
      summary: 'Empresa farmacêutica buscando equipamentos de secagem para medicamentos.',
      sent_at: '2024-01-14T16:30:00Z',
      status: 'lost',
      generated_sale: false,
      last_contact: '2024-01-14T18:15:00Z',
      priority: 'high',
      estimated_value: 120000
    }
  ]);

  const sellers = ['Carlos Silva', 'Ana Santos', 'João Costa', 'Maria Oliveira'];

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.phone_number.includes(searchTerm) ||
                         lead.product_interest.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesSeller = sellerFilter === 'all' || lead.seller_name === sellerFilter;
    const matchesPriority = priorityFilter === 'all' || lead.priority === priorityFilter;
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
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
    
    return matchesSearch && matchesStatus && matchesSeller && matchesPriority && matchesDate;
  });

  const stats = {
    total: leads.length,
    sold: leads.filter(l => l.status === 'sold').length,
    attending: leads.filter(l => l.status === 'attending').length,
    conversionRate: Math.round((leads.filter(l => l.generated_sale).length / leads.length) * 100),
    totalValue: leads.filter(l => l.generated_sale).reduce((sum, l) => sum + l.estimated_value, 0),
    avgTicket: leads.filter(l => l.generated_sale).length > 0 
      ? Math.round(leads.filter(l => l.generated_sale).reduce((sum, l) => sum + l.estimated_value, 0) / leads.filter(l => l.generated_sale).length)
      : 0
  };

  const handleMarkSale = (leadId: string) => {
    setLeads(prev => 
      prev.map(lead => 
        lead.id === leadId 
          ? { ...lead, status: 'sold' as const, generated_sale: true }
          : lead
      )
    );
    
    toast({
      title: "Venda Marcada",
      description: "Lead marcado como venda realizada com sucesso",
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-drystore-error';
      case 'medium':
        return 'text-drystore-warning';
      case 'low':
        return 'text-drystore-success';
      default:
        return 'text-muted-foreground';
    }
  };

  const getTimeSinceContact = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return `${diffHours}h atrás`;
    } else {
      return `${Math.floor(diffHours / 24)}d atrás`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                {sellers.map(seller => (
                  <SelectItem key={seller} value={seller}>{seller}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Prioridades</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
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
                <TableHead>Produto Interesse</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Valor Est.</TableHead>
                <TableHead>Último Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <p className="font-medium">{lead.customer_name}</p>
                      {lead.generated_sale && (
                        <span className="text-xs bg-drystore-success/10 text-drystore-success px-2 py-1 rounded">
                          Venda realizada
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{lead.phone_number}</TableCell>
                  <TableCell>{lead.seller_name}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{lead.product_interest}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-xs">
                        {lead.summary}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className={`h-2 w-2 rounded-full ${getPriorityColor(lead.priority).replace('text-', 'bg-')}`}></div>
                      <span className={`text-sm capitalize ${getPriorityColor(lead.priority)}`}>
                        {lead.priority === 'high' ? 'Alta' : lead.priority === 'medium' ? 'Média' : 'Baixa'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">R$ {(lead.estimated_value / 1000).toFixed(0)}k</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{getTimeSinceContact(lead.last_contact)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      {lead.status === 'attending' && !lead.generated_sale && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleMarkSale(lead.id)}
                          className="text-drystore-success hover:bg-drystore-success/10"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}