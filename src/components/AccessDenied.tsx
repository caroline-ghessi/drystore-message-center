import { AlertTriangle, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { forceLogout } from "@/hooks/useAuthSecurity";
import { useAuth } from "@/hooks/useAuth";

interface AccessDeniedProps {
  approvalStatus: 'pending' | 'rejected' | 'none';
  userEmail?: string;
}

export const AccessDenied = ({ approvalStatus, userEmail }: AccessDeniedProps) => {
  const { user } = useAuth();

  const handleLogout = async () => {
    await forceLogout();
  };

  const getStatusMessage = () => {
    switch (approvalStatus) {
      case 'pending':
        return {
          title: "Aguardando Aprovação",
          description: "Sua conta foi criada com sucesso, mas ainda está aguardando aprovação de um administrador. Você receberá um e-mail quando sua conta for aprovada.",
          icon: <Mail className="h-6 w-6 text-amber-500" />,
          variant: "default" as const
        };
      case 'rejected':
        return {
          title: "Acesso Negado",
          description: "Sua solicitação de acesso foi negada. Entre em contato com o administrador do sistema para mais informações.",
          icon: <AlertTriangle className="h-6 w-6 text-destructive" />,
          variant: "destructive" as const
        };
      default:
        return {
          title: "Acesso Não Autorizado",
          description: "Sua conta não possui as permissões necessárias para acessar esta plataforma. Entre em contato com o administrador.",
          icon: <AlertTriangle className="h-6 w-6 text-destructive" />,
          variant: "destructive" as const
        };
    }
  };

  const status = getStatusMessage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-drystore-gray-light to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status.icon}
          </div>
          <CardTitle className="text-xl">{status.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant={status.variant}>
            <AlertDescription>
              {status.description}
            </AlertDescription>
          </Alert>

          {user?.email && (
            <div className="text-sm text-muted-foreground text-center">
              <p><strong>E-mail:</strong> {user.email}</p>
              <p><strong>Status:</strong> {approvalStatus === 'pending' ? 'Pendente' : approvalStatus === 'rejected' ? 'Rejeitado' : 'Sem permissão'}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={handleLogout} variant="outline" className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Fazer Logout
            </Button>
          </div>

          {approvalStatus === 'pending' && (
            <div className="text-xs text-muted-foreground text-center">
              <p>Você será notificado por e-mail assim que sua conta for aprovada.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};