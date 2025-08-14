import { Building2, MessageSquare, Users, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthSecurity } from "@/hooks/useAuthSecurity";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: securityLoading } = useAuthSecurity();
  const navigate = useNavigate();

  // Redirect authenticated users with access directly to dashboard
  useEffect(() => {
    if (!authLoading && !securityLoading && user && hasAccess) {
      navigate('/dashboard');
    }
  }, [user, hasAccess, authLoading, securityLoading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-drystore-gray-light to-white">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="h-16 w-16 bg-drystore-orange rounded-2xl flex items-center justify-center">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground">Drystore</h1>
              <p className="text-lg text-muted-foreground">Plataforma de Atendimento WhatsApp</p>
            </div>
          </div>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Gerencie atendimentos, monitore vendedores e acompanhe leads de forma inteligente com nossa plataforma integrada.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg" className="bg-gradient-primary hover:opacity-90">
              <Link to="/login">
                Fazer Login
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/login">
                Criar Conta
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="text-center">
            <CardHeader>
              <MessageSquare className="h-12 w-12 text-drystore-orange mx-auto mb-4" />
              <CardTitle>Mensagens Centralizadas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Gerencie todas as conversas do WhatsApp oficial e acompanhe o atendimento dos vendedores em tempo real.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Users className="h-12 w-12 text-drystore-orange mx-auto mb-4" />
              <CardTitle>Controle de Vendedores</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Monitore a qualidade do atendimento, performance de vendas e receba insights automáticos sobre melhorias.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Target className="h-12 w-12 text-drystore-orange mx-auto mb-4" />
              <CardTitle>Gestão de Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Qualifique leads automaticamente com IA e distribua para os vendedores mais adequados para cada cliente.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
