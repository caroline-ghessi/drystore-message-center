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

export default function Dashboard() {
  // Mock data - substituir por dados reais do Supabase
  const metrics = [
    {
      title: "Mensagens Hoje",
      value: 127,
      icon: MessageSquare,
      trend: { value: 12, type: 'increase' as const },
      color: 'orange' as const
    },
    {
      title: "Conversas Ativas",
      value: 34,
      icon: Users,
      trend: { value: 8, type: 'increase' as const },
      color: 'blue' as const
    },
    {
      title: "Leads Gerados",
      value: 18,
      icon: Target,
      trend: { value: 5, type: 'decrease' as const },
      color: 'green' as const
    },
    {
      title: "Taxa de Conversão",
      value: "23%",
      icon: TrendingUp,
      trend: { value: 3, type: 'increase' as const },
      color: 'green' as const
    }
  ];

  const recentActivity = [
    {
      id: 1,
      customer: "João Silva",
      phone: "(11) 99999-9999",
      action: "Enviado ao vendedor Carlos",
      time: "2 min atrás",
      status: "sent_to_seller"
    },
    {
      id: 2,
      customer: "Maria Santos",
      phone: "(11) 88888-8888",
      action: "Conversa finalizada",
      time: "5 min atrás",
      status: "finished"
    },
    {
      id: 3,
      customer: "Pedro Costa",
      phone: "(11) 77777-7777",
      action: "Aguardando avaliação",
      time: "8 min atrás",
      status: "waiting_evaluation"
    }
  ];

  const sellerPerformance = [
    { name: "Carlos Silva", leads: 12, conversions: 8, rate: "67%" },
    { name: "Ana Santos", leads: 15, conversions: 9, rate: "60%" },
    { name: "João Costa", leads: 8, conversions: 4, rate: "50%" },
    { name: "Maria Oliveira", leads: 10, conversions: 6, rate: "60%" }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral do atendimento WhatsApp
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
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

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-drystore-orange" />
              <span>Atividade Recente</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
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
                    </div>
                  </div>
                </div>
              ))}
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
            <div className="space-y-4">
              {sellerPerformance.map((seller, index) => (
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
              ))}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-drystore-orange/10 rounded-lg">
              <div className="text-2xl font-bold text-drystore-orange">23</div>
              <div className="text-sm text-muted-foreground">Atendimento Bot</div>
            </div>
            <div className="text-center p-4 bg-drystore-warning/10 rounded-lg">
              <div className="text-2xl font-bold text-drystore-warning">8</div>
              <div className="text-sm text-muted-foreground">Aguardando Avaliação</div>
            </div>
            <div className="text-center p-4 bg-drystore-info/10 rounded-lg">
              <div className="text-2xl font-bold text-drystore-info">15</div>
              <div className="text-sm text-muted-foreground">Com Vendedores</div>
            </div>
            <div className="text-center p-4 bg-drystore-success/10 rounded-lg">
              <div className="text-2xl font-bold text-drystore-success">42</div>
              <div className="text-sm text-muted-foreground">Finalizadas</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}