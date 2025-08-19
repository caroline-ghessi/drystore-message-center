import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthSecurity } from '@/hooks/useAuthSecurity';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { User, CheckCircle2, XCircle } from 'lucide-react';

interface OperatorAssignmentPanelProps {
  conversationId: string;
  currentOperatorId?: string;
  customerName: string;
  onAssignmentChange?: () => void;
}

export const OperatorAssignmentPanel = ({ 
  conversationId, 
  currentOperatorId, 
  customerName,
  onAssignmentChange 
}: OperatorAssignmentPanelProps) => {
  const { isAdmin, isManager } = useAuthSecurity();
  const [isAssigning, setIsAssigning] = useState(false);

  // Only admins and managers can assign operators
  if (!isAdmin && !isManager) {
    return null;
  }

  const handleSelfAssign = async () => {
    setIsAssigning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('conversations')
        .update({ assigned_operator_id: user.id })
        .eq('id', conversationId);

      if (error) throw error;

      toast({
        title: "Conversa Atribuída",
        description: `Você agora é responsável pela conversa com ${customerName}`,
      });
      
      onAssignmentChange?.();
    } catch (error) {
      console.error('Erro ao atribuir conversa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atribuir a conversa",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async () => {
    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ assigned_operator_id: null })
        .eq('id', conversationId);

      if (error) throw error;

      toast({
        title: "Atribuição Removida",
        description: `A conversa com ${customerName} não está mais atribuída`,
      });
      
      onAssignmentChange?.();
    } catch (error) {
      console.error('Erro ao remover atribuição:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a atribuição",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" />
          Atribuição de Operador
        </CardTitle>
        <CardDescription>
          Controle de acesso seguro para dados do cliente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentOperatorId ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Atribuída
              </Badge>
              <span className="text-sm text-muted-foreground">
                Operador responsável
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnassign}
              disabled={isAssigning}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Remover Atribuição
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                <XCircle className="h-3 w-3 mr-1" />
                Não Atribuída
              </Badge>
              <span className="text-sm text-muted-foreground">
                Disponível para qualquer operador
              </span>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleSelfAssign}
              disabled={isAssigning}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Atribuir para Mim
            </Button>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <strong>🔒 Segurança:</strong> Apenas operadores atribuídos podem visualizar 
          dados sensíveis desta conversa (telefone completo, histórico detalhado).
        </div>
      </CardContent>
    </Card>
  );
};