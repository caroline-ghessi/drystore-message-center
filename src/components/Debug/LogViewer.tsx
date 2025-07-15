import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSystemLogs, useWebhookLogs, useRealtimeLogs } from "@/hooks/useDebugData";
import { Activity, Globe, Search, Filter, AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function LogViewer() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data: systemLogs = [], isLoading: systemLoading } = useSystemLogs();
  const { data: webhookLogs = [], isLoading: webhookLoading } = useWebhookLogs();
  
  // Ativa o listener em tempo real
  useRealtimeLogs();

  const filteredSystemLogs = systemLogs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || log.type === typeFilter;
    const matchesSource = sourceFilter === "all" || log.source === sourceFilter;
    
    return matchesSearch && matchesType && matchesSource;
  });

  const filteredWebhookLogs = webhookLogs.filter(log => {
    const matchesSearch = log.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = sourceFilter === "all" || log.source === sourceFilter;
    
    return matchesSearch && matchesSource;
  });

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: number | null) => {
    if (!status) return 'bg-gray-50 text-gray-700';
    if (status >= 200 && status < 300) return 'bg-green-50 text-green-700';
    if (status >= 400) return 'bg-red-50 text-red-700';
    return 'bg-orange-50 text-orange-700';
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return 'Data inválida';
    }
  };

  // Obter valores únicos para os filtros
  const uniqueTypes = [...new Set(systemLogs.map(log => log.type))];
  const uniqueSources = [...new Set([
    ...systemLogs.map(log => log.source),
    ...webhookLogs.map(log => log.source)
  ])];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros de Log</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar nos logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Origem</label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueSources.map(source => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Logs do Sistema</span>
            <Badge variant="outline">{filteredSystemLogs.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {systemLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Carregando logs...</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredSystemLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getLogIcon(log.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {log.type}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {log.source}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-gray-900 break-words">
                          {log.message}
                        </p>
                        {log.details && Object.keys(log.details as object).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer">
                              Ver detalhes
                            </summary>
                            <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                      {formatTime(log.created_at || '')}
                    </span>
                  </div>
                </div>
              ))}
              {filteredSystemLogs.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    Nenhum log encontrado com os filtros aplicados
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs de Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="h-5 w-5" />
            <span>Logs de Webhook</span>
            <Badge variant="outline">{filteredWebhookLogs.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {webhookLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Carregando webhooks...</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredWebhookLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getStatusColor(log.response_status)}`}
                        >
                          {log.method} {log.response_status || 'Pending'}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {log.source}
                        </Badge>
                      </div>
                      <p className="text-sm font-mono text-gray-900 break-all mb-2">
                        {log.url}
                      </p>
                      {log.error_message && (
                        <p className="text-sm text-red-600 mb-2">
                          ❌ {log.error_message}
                        </p>
                      )}
                      {(log.body || log.response_body) && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer">
                            Ver payload
                          </summary>
                          <div className="mt-1 space-y-2">
                            {log.body && (
                              <div>
                                <p className="text-xs font-medium text-gray-700">Request:</p>
                                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                  {JSON.stringify(log.body, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.response_body && (
                              <div>
                                <p className="text-xs font-medium text-gray-700">Response:</p>
                                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                  {JSON.stringify(log.response_body, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                      {formatTime(log.created_at || '')}
                    </span>
                  </div>
                </div>
              ))}
              {filteredWebhookLogs.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    Nenhum webhook encontrado com os filtros aplicados
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}