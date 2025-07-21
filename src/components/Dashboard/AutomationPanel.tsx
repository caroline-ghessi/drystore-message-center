import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Bot, 
  Clock, 
  Target, 
  TrendingUp, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Users,
  Zap,
  PlayCircle,
  PauseCircle
} from "lucide-react";
import { useAutomationMetrics, useAutomationActivity, useSellerAutomationStats } from "@/hooks/useAutomationMetrics";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AutomationPanel() {
  const { data: metrics, isLoading: metricsLoading } = useAutomationMetrics();
  const { data: activity, isLoading: activityLoading } = useAutomationActivity();
  const { data: sellerStats, isLoading: sellersLoading } = useSellerAutomationStats();

  if (metricsLoading) {
    return <div className="animate-pulse">Carregando métricas de automação...</div>;
  }

  const automationMetrics = [
    {
      title: "Conversas Processadas",
      value: metrics?.conversationsProcessed || 0,
      icon: Bot,
      trend: { value: 15, type: 'increase' as const },
      color: 'blue' as const
    },
    {
      title: "Taxa de Qualificação",
      value: `${metrics?.qualificationRate || 0}%`,
      icon: Target,
      trend: { value: 8, type: 'increase' as const },
      color: 'green' as const
    },
    {
      title: "Leads Automáticos",
      value: metrics?.leadsGenerated || 0,
      icon: Zap,
      trend: { value: 12, type: 'increase' as const },
      color: 'orange' as const
    },
    {
      title: "Tempo Médio (min)",
      value: metrics?.avgProcessingTime || 0,
      icon: Clock,
      trend: { value: 2, type: 'decrease' as const },
      color: 'blue' as const
    }
  ];

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'waiting_evaluation':
        return { label: 'Aguardando Avaliação', color: 'bg-drystore-warning', icon: Clock };
      case 'sent_to_seller':
        return { label: 'Enviado ao Vendedor', color: 'bg-drystore-info', icon: Users };
      case 'finished':
        return { label: 'Finalizada', color: 'bg-drystore-success', icon: CheckCircle };
      default:
        return { label: 'Desconhecido', color: 'bg-muted', icon: AlertTriangle };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="h-6 w-6 text-drystore-primary" />
            Automação de Leads
          </h2>
          <p className="text-muted-foreground">
            Monitoramento do sistema de transferência automática
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={metrics?.automationActive ? "default" : "secondary"}
            className="flex items-center gap-1"
          >
            {metrics?.automationActive ? (
              <PlayCircle className="h-3 w-3" />
            ) : (
              <PauseCircle className="h-3 w-3" />
            )}
            {metrics?.automationActive ? 'Ativa' : 'Pausada'}
          </Badge>
          <Button variant="outline" size="sm">
            Configurar
          </Button>
        </div>
      </div>

      {/* Métricas de Automação */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {automationMetrics.map((metric, index) => (
          <MetricCard
            key={index}
            title={metric.title}
            value={metric.value}
            icon={metric.icon}
            trend={metric.trend}
            color={metric.color}
          />
        ))}
      </div>

      {/* Funil de Conversão e Atividade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil de Conversão */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-drystore-primary" />
              <span>Funil de Automação</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-drystore-primary/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-drystore-primary" />
                  <span className="font-medium">Conversas Inativas</span>
                </div>
                <span className="text-lg font-bold">{metrics?.conversationsProcessed || 0}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-drystore-warning/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-drystore-warning" />
                  <span className="font-medium">Em Avaliação</span>
                </div>
                <span className="text-lg font-bold">{metrics?.pendingEvaluations || 0}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-drystore-success/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-drystore-success" />
                  <span className="font-medium">Qualificados</span>
                </div>
                <span className="text-lg font-bold">{metrics?.leadsGenerated || 0}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-drystore-info/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-drystore-info" />
                  <span className="font-medium">Enviados</span>
                </div>
                <span className="text-lg font-bold">{metrics?.successfulTransfers || 0}</span>
              </div>

              {metrics?.failedEvaluations > 0 && (
                <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="font-medium">Falhas</span>
                  </div>
                  <span className="text-lg font-bold text-destructive">{metrics.failedEvaluations}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Atividade Recente */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-drystore-orange" />
              <span>Atividade Automática</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityLoading ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted rounded-lg"></div>
                  ))}
                </div>
              ) : activity && activity.length > 0 ? (
                activity.map((item) => {
                  const statusInfo = getStatusInfo(item.status);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{item.customer_name}</span>
                          <span className="text-sm text-muted-foreground">
                            {item.phone_number}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusIcon className="h-3 w-3" />
                          <span className="text-sm text-muted-foreground">
                            {statusInfo.label}
                            {item.seller_name && ` - ${item.seller_name}`}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </p>
                        <div className={`h-2 w-2 ${statusInfo.color} rounded-full mt-1`}></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground">
                  Nenhuma atividade recente
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance dos Vendedores - Automação */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-drystore-success" />
            <span>Performance - Leads Automáticos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sellersLoading ? (
              <div className="animate-pulse space-y-2 col-span-full">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-muted rounded-lg"></div>
                ))}
              </div>
            ) : sellerStats && sellerStats.length > 0 ? (
              sellerStats.map((seller) => (
                <div key={seller.seller_id} className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{seller.seller_name}</h4>
                    <Badge variant="outline">
                      Carga: {seller.current_workload}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Leads Auto:</span>
                      <span className="font-medium">{seller.auto_leads_received}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conv. Auto:</span>
                      <span className="font-medium text-drystore-success">
                        {seller.auto_conversion_rate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resp. Média:</span>
                      <span className="font-medium">{seller.avg_response_time}min</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground col-span-full">
                Nenhum dado de vendedores disponível
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}