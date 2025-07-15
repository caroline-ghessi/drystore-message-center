import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bug, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Search,
  Download,
  RefreshCw,
  Terminal,
  Activity,
  Zap
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SystemLog {
  id: string;
  type: 'error' | 'info' | 'warning';
  source: 'whatsapp_api' | 'dify' | 'whapi' | 'grok' | 'claude' | 'system';
  message: string;
  details?: any;
  created_at: string;
}

export default function Debug() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Mock data - substituir por dados reais do Supabase
  const logs: SystemLog[] = [
    {
      id: '1',
      type: 'error',
      source: 'whatsapp_api',
      message: 'Falha ao enviar mensagem para +5511999999999',
      details: { error_code: 'RATE_LIMIT', retry_count: 3 },
      created_at: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      type: 'info',
      source: 'dify',
      message: 'Resposta do chatbot gerada com sucesso',
      details: { response_time: 1.2, tokens_used: 150 },
      created_at: '2024-01-15T10:29:45Z'
    },
    {
      id: '3',
      type: 'warning',
      source: 'whapi',
      message: 'Token próximo do limite de uso',
      details: { usage_percentage: 85, reset_time: '2024-01-16T00:00:00Z' },
      created_at: '2024-01-15T10:25:00Z'
    },
    {
      id: '4',
      type: 'info',
      source: 'system',
      message: 'Lead enviado ao vendedor Carlos Silva',
      details: { lead_id: 'lead_123', customer: 'João Silva' },
      created_at: '2024-01-15T10:20:00Z'
    },
    {
      id: '5',
      type: 'error',
      source: 'grok',
      message: 'Falha na análise de sentimento da mensagem',
      details: { message_id: 'msg_456', retry_scheduled: true },
      created_at: '2024-01-15T10:15:00Z'
    }
  ];

  const connectionStatus = {
    whatsapp_api: { status: 'connected', last_check: '2024-01-15T10:30:00Z' },
    dify: { status: 'connected', last_check: '2024-01-15T10:29:00Z' },
    whapi: { status: 'warning', last_check: '2024-01-15T10:25:00Z' },
    grok: { status: 'error', last_check: '2024-01-15T10:15:00Z' },
    claude: { status: 'disconnected', last_check: '2024-01-15T09:00:00Z' }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.source.includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || log.type === typeFilter;
    const matchesSource = sourceFilter === 'all' || log.source === sourceFilter;
    
    return matchesSearch && matchesType && matchesSource;
  });

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertCircle className="h-4 w-4 text-drystore-error" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-drystore-warning" />;
      case 'info': return <Info className="h-4 w-4 text-drystore-info" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-drystore-success/10 text-drystore-success border-drystore-success/20';
      case 'warning': return 'bg-drystore-warning/10 text-drystore-warning border-drystore-warning/20';
      case 'error': return 'bg-drystore-error/10 text-drystore-error border-drystore-error/20';
      case 'disconnected': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Debug & Monitoramento</h1>
          <p className="text-muted-foreground mt-1">
            Logs do sistema e status das integrações
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar Logs
          </Button>
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="logs" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="logs">Logs do Sistema</TabsTrigger>
          <TabsTrigger value="connections">Status das Conexões</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          {/* Filters */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Search className="h-5 w-5 text-drystore-orange" />
                <span>Filtros</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nos logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Tipos</SelectItem>
                    <SelectItem value="error">Erro</SelectItem>
                    <SelectItem value="warning">Aviso</SelectItem>
                    <SelectItem value="info">Informação</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Fonte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Fontes</SelectItem>
                    <SelectItem value="whatsapp_api">WhatsApp API</SelectItem>
                    <SelectItem value="dify">Dify</SelectItem>
                    <SelectItem value="whapi">WHAPI</SelectItem>
                    <SelectItem value="grok">Grok</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="system">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Logs List */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Terminal className="h-5 w-5 text-drystore-orange" />
                <span>Logs Recentes</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        {getLogIcon(log.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge variant="outline" className={getStatusColor(log.type)}>
                              {log.type.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">
                              {log.source.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{log.message}</p>
                          {log.details && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                Ver detalhes
                              </summary>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(log.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(connectionStatus).map(([service, status]) => (
              <Card key={service} className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium capitalize">{service.replace('_', ' ')}</h3>
                    <Badge variant="outline" className={getStatusColor(status.status)}>
                      {status.status}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Última verificação:</p>
                    <p className="font-mono text-xs">{formatTime(status.last_check)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="w-full mt-4">
                    <Zap className="h-4 w-4 mr-2" />
                    Testar Conexão
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <Activity className="h-8 w-8 text-drystore-info" />
                  <div>
                    <p className="text-2xl font-bold">99.2%</p>
                    <p className="text-sm text-muted-foreground">Uptime</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <Zap className="h-8 w-8 text-drystore-warning" />
                  <div>
                    <p className="text-2xl font-bold">245ms</p>
                    <p className="text-sm text-muted-foreground">Latência Média</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-8 w-8 text-drystore-error" />
                  <div>
                    <p className="text-2xl font-bold">3</p>
                    <p className="text-sm text-muted-foreground">Erros (24h)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <Info className="h-8 w-8 text-drystore-success" />
                  <div>
                    <p className="text-2xl font-bold">1.2k</p>
                    <p className="text-sm text-muted-foreground">Mensagens/dia</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Métricas de Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center p-8 bg-muted rounded-lg">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Gráficos de performance serão implementados em versões futuras
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}