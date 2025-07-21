
import { MetricCard } from "@/components/ui/metric-card";
import { 
  MessageSquare, 
  Users, 
  TrendingUp, 
  Clock,
  Target,
  CheckCircle,
  AlertCircle,
  DollarSign
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutomationPanel } from "@/components/Dashboard/AutomationPanel";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { useSellerPerformance } from "@/hooks/useSellerPerformance";
import { useConversationStatus } from "@/hooks/useConversationStatus";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity();
  const { data: sellerPerformance, isLoading: sellersLoading } = useSellerPerformance();
  const { data: conversationStatus, isLoading: statusLoading } = useConversationStatus();

  // Preparar dados das métricas principais
  const metricsData = [
    {
      title: "Mensagens Hoje",
      value: metrics?.messagesToday || 0,
      icon: MessageSquare,
      trend: { value: 12, type: 'increase' as const },
      color: 'orange' as const
    },
    {
      title: "Conversas Ativas",
      value: metrics?.activeConversations || 0,
      icon: Users,
      trend: { value: 8, type: 'increase' as const },
      color: 'blue' as const
    },
    {
      title: "Leads Gerados",
      value: metrics?.leadsGenerated || 0,
      icon: Target,
      trend: { value: 5, type: 'decrease' as const },
      color: 'green' as const
    },
    {
      title: "Taxa de Conversão",
      value: metrics?.conversionRate || "0%",
      icon: TrendingUp,
      trend: { value: 3, type: 'increase' as const },
      color: 'green' as const
    }
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do atendimento WhatsApp
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricsLoading ? (
            // Loading skeletons
            Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="shadow-card">
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            metricsData.map((metric, index) => (
              <MetricCard
                key={index}
                title={metric.title}
                value={metric.value}
                icon={metric.icon}
                trend={metric.trend}
                color={metric.color}
              />
            ))
          )}
        </div>

        {/* Painel de Automação */}
        <AutomationPanel />

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Activity */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-drystore-orange" />
                <span>Atividade Recente</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activityLoading ? (
                  // Loading skeletons
                  Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full" />
                  ))
                ) : recentActivity && recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{activity.customer}</span>
                          <span className="text-sm text-muted-foreground">
                            {activity.phone}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.action}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {activity.time}
                        </p>
                        <div className="mt-1">
                          {activity.status === 'sent_to_seller' && (
                            <div className="h-2 w-2 bg-drystore-info rounded-full"></div>
                          )}
                          {activity.status === 'finished' && (
                            <div className="h-2 w-2 bg-drystore-success rounded-full"></div>
                          )}
                          {activity.status === 'waiting_evaluation' && (
                            <div className="h-2 w-2 bg-drystore-warning rounded-full"></div>
                          )}
                          {activity.status === 'bot_attending' && (
                            <div className="h-2 w-2 bg-drystore-orange rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhuma atividade recente
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Seller Performance */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-drystore-success" />
                <span>Performance dos Vendedores</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sellersLoading ? (
                  // Loading skeletons
                  Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full" />
                  ))
                ) : sellerPerformance && sellerPerformance.length > 0 ? (
                  sellerPerformance.map((seller, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{seller.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {seller.leads} leads • {seller.conversions} conversões
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-drystore-success">
                          {seller.rate}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          taxa de conversão
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum dado de performance disponível
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Overview */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-drystore-warning" />
              <span>Status das Conversas</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {statusLoading ? (
                // Loading skeletons
                Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full" />
                ))
              ) : (
                <>
                  <div className="text-center p-4 bg-drystore-orange/10 rounded-lg">
                    <div className="text-2xl font-bold text-drystore-orange">
                      {conversationStatus?.botAttending || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Atendimento Bot</div>
                  </div>
                  <div className="text-center p-4 bg-drystore-warning/10 rounded-lg">
                    <div className="text-2xl font-bold text-drystore-warning">
                      {conversationStatus?.waitingEvaluation || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Aguardando Avaliação</div>
                  </div>
                  <div className="text-center p-4 bg-drystore-info/10 rounded-lg">
                    <div className="text-2xl font-bold text-drystore-info">
                      {conversationStatus?.withSellers || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Com Vendedores</div>
                  </div>
                  <div className="text-center p-4 bg-drystore-success/10 rounded-lg">
                    <div className="text-2xl font-bold text-drystore-success">
                      {conversationStatus?.finished || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Finalizadas</div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
