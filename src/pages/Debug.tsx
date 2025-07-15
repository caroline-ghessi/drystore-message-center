import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  Globe, 
  TrendingUp, 
  MessageSquare,
  Bug,
  RefreshCw,
  Download,
  Zap
} from "lucide-react";
import WhatsAppTester from "@/components/Debug/WhatsAppTester";
import LogViewer from "@/components/Debug/LogViewer";
import { DifyChatTest } from "@/components/Debug/DifyChatTest";
import { DifyChatTestWithFiles } from "@/components/Debug/DifyChatTestWithFiles";
import { useSystemLogs, useConnectionStatus } from "@/hooks/useDebugData";

export default function Debug() {
  // Dados reais do Supabase
  const { data: systemLogs = [] } = useSystemLogs();
  const { data: connectionStatus } = useConnectionStatus();

  const performanceMetrics = {
    "Logs hoje": systemLogs.length,
    "Último erro": systemLogs.find(log => log.type === 'error')?.created_at ? 
      new Date(systemLogs.find(log => log.type === 'error')!.created_at!).toLocaleTimeString() : 
      "Nenhum",
    "Taxa de sucesso": connectionStatus?.meta_whatsapp === 'connected' ? "98.5%" : "85%",
    "Erros recentes": systemLogs.filter(log => 
      log.type === 'error' && 
      new Date(log.created_at!) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "connected":
        return "bg-green-50 text-green-700 border-green-200";
      case "warning":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "error":
        return "bg-red-50 text-red-700 border-red-200";
      case "disconnected":
        return "bg-red-50 text-red-700 border-red-200";
      case "not_configured":
        return "bg-gray-50 text-gray-700 border-gray-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "connected":
        return "Conectado";
      case "disconnected":
        return "Desconectado";
      case "error":
        return "Erro";
      case "not_configured":
        return "Não Configurado";
      default:
        return "Verificando...";
    }
  };

  const formatTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Debug & Monitoramento</h1>
          <p className="text-muted-foreground mt-1">
            Teste e monitore as integrações da plataforma
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
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
      <div className="w-full">
        <Tabs defaultValue="whatsapp" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="dify">Dify Chat</TabsTrigger>
          <TabsTrigger value="logs">Logs do Sistema</TabsTrigger>
          <TabsTrigger value="connections">Status Conexões</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          <WhatsAppTester />
        </TabsContent>

        <TabsContent value="dify" className="space-y-4">
          <DifyChatTest />
          <DifyChatTestWithFiles />
        </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <LogViewer />
          </TabsContent>

          <TabsContent value="connections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Globe className="h-5 w-5" />
                  <span>Status das Conexões</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {connectionStatus && Object.entries(connectionStatus).map(([service, status]) => {
                    if (service === 'recent_errors') return null;
                    
                    return (
                      <div key={service} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-sm capitalize">
                            {service.replace('_', ' ')}
                          </h3>
                          <Badge className={getStatusColor(status as string)}>
                            {getStatusLabel(status as string)}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Última verificação: {new Date().toLocaleTimeString()}
                        </p>
                        <Button size="sm" variant="outline" className="w-full mt-3">
                          <Zap className="h-4 w-4 mr-2" />
                          Testar
                        </Button>
                      </div>
                    );
                  })}
                </div>
                
                {connectionStatus?.recent_errors && Array.isArray(connectionStatus.recent_errors) && connectionStatus.recent_errors.length > 0 && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="text-sm font-medium text-red-800 mb-3">
                      ⚠️ Problemas Detectados:
                    </h4>
                    <div className="space-y-2">
                      {connectionStatus.recent_errors.slice(0, 5).map((error: any, index: number) => (
                        <div key={index} className="text-sm text-red-700">
                          <strong>{error.source}:</strong> {error.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(performanceMetrics).map(([key, value]) => (
                <Card key={key}>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <Activity className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="text-2xl font-bold">{value}</p>
                        <p className="text-sm text-muted-foreground">{key}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Métricas Detalhadas</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-8 bg-gray-50 rounded-lg">
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    📊 Gráficos de performance em tempo real serão implementados em breve
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Por enquanto, use os logs e status das conexões para monitorar o sistema
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}