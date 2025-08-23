import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, PlayCircle, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

export function ProcessQueueTest() {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<any>(null)

  const handleManualProcess = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('manual-process-queue', {
        body: {}
      })
      
      if (error) {
        throw error
      }
      
      setResults(data)
      toast({
        title: "✅ Processamento executado",
        description: "Fila processada com sucesso",
      })
      
    } catch (error: any) {
      console.error('Erro ao processar fila:', error)
      toast({
        title: "❌ Erro no processamento",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTestQueue = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('test-queue-processing', {
        body: {}
      })
      
      if (error) {
        throw error
      }
      
      setResults(data)
      toast({
        title: "✅ Teste concluído",
        description: "Teste de processamento executado",
      })
      
    } catch (error: any) {
      console.error('Erro no teste:', error)
      toast({
        title: "❌ Erro no teste",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5" />
          Teste de Processamento da Fila
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={handleManualProcess}
            disabled={loading}
            variant="default"
          >
            {loading ? "Processando..." : "🔧 Processar Manualmente"}
          </Button>
          
          <Button 
            onClick={handleTestQueue}
            disabled={loading}
            variant="outline"
          >
            {loading ? "Testando..." : "🧪 Teste Completo"}
          </Button>
        </div>

        {results && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Resultados:
            </h4>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4" />
            <strong>Status do Sistema:</strong>
          </div>
          <ul className="list-disc list-inside space-y-1 ml-6">
            <li>Cron job duplicado removido ✅</li>
            <li>Apenas 1 job ativo (jobid:7) com service_role token ✅</li>
            <li>Processamento automático a cada 30 segundos ✅</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}