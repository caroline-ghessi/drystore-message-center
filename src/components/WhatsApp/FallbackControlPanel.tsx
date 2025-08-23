import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { User, Bot, ArrowLeft, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface FallbackControlPanelProps {
  conversationId: string;
  fallbackMode: boolean;
  fallbackTakenBy?: string;
  fallbackTakenAt?: string;
  onFallbackChange?: () => void;
}

export function FallbackControlPanel({
  conversationId,
  fallbackMode,
  fallbackTakenBy,
  fallbackTakenAt,
  onFallbackChange
}: FallbackControlPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const canReturnToBot = fallbackMode && fallbackTakenBy === user?.id;
  
  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min atrás`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} h atrás`;
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const handleAssume = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          fallback_mode: true, 
          status: 'fallback_active',
          fallback_taken_by: user.id
        })
        .eq('id', conversationId);

      if (error) throw error;

      await supabase.from('system_logs').insert({
        type: 'info',
        source: 'fallback_system',
        message: `Operador assumiu controle da conversa`,
        details: {
          conversation_id: conversationId,
          operator_id: user.id,
          operator_email: user.email,
          action: 'assume_control'
        }
      });
      
      toast({
        title: "Controle Assumido",
        description: "Você assumiu o controle desta conversa. O bot foi desativado.",
      });

      onFallbackChange?.();
    } catch (error) {
      console.error('Erro ao assumir controle:', error);
      toast({
        title: "Erro",
        description: "Erro ao assumir controle da conversa.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnToBot = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          fallback_mode: false, 
          status: 'bot_attending',
          fallback_taken_by: null
        })
        .eq('id', conversationId);

      if (error) throw error;

      await supabase.from('system_logs').insert({
        type: 'info',
        source: 'fallback_system',
        message: `Conversa devolvida ao bot`,
        details: {
          conversation_id: conversationId,
          operator_id: user.id,
          operator_email: user.email,
          action: 'return_to_bot'
        }
      });
      
      toast({
        title: "Devolvido ao Bot",
        description: "O bot Dify voltou a processar esta conversa automaticamente.",
      });

      onFallbackChange?.();
    } catch (error) {
      console.error('Erro ao devolver ao bot:', error);
      toast({
        title: "Erro",
        description: "Erro ao devolver conversa ao bot.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (fallbackMode) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-amber-600" />
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Modo Manual
                </Badge>
              </div>
              {fallbackTakenAt && (
                <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Assumido {formatTime(fallbackTakenAt)}</span>
                </div>
              )}
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  size="sm" 
                  variant={canReturnToBot ? "default" : "outline"}
                  disabled={!canReturnToBot || isLoading}
                  className="flex items-center space-x-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Devolver ao Bot</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center space-x-2">
                    <Bot className="h-5 w-5 text-blue-600" />
                    <span>Devolver ao Bot Dify</span>
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    O controle desta conversa será devolvido ao bot Dify, que voltará a processar as mensagens automaticamente. 
                    Esta ação reativará o atendimento automático. Deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReturnToBot}>
                    Devolver ao Bot
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
            Você está controlando esta conversa manualmente. O bot está desativado.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="h-4 w-4 text-blue-600" />
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Bot Ativo
            </Badge>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                size="sm" 
                variant="outline" 
                disabled={isLoading}
                className="flex items-center space-x-1"
              >
                <User className="h-3 w-3" />
                <span>Assumir Controle</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <span>Assumir Controle Manual</span>
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Ao assumir esta conversa, o bot Dify será desativado e você assumirá o controle total. 
                  Você poderá devolver o controle ao bot a qualquer momento. Deseja continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleAssume}>
                  Assumir Controle
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        
        <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
          O bot Dify está processando esta conversa automaticamente.
        </p>
      </div>
    </Card>
  );
}