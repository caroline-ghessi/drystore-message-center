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

  const handleSystemFix = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('fix-system-complete', {
        body: {}
      })
      
      if (error) {
        throw error
      }
      
      setResults(data)
      toast({
        title: "🔧 Sistema corrigido!",
        description: "Todas as correções foram aplicadas com sucesso",
      })
      
    } catch (error: any) {
      console.error('Erro na correção:', error)
      toast({
        title: "❌ Erro na correção",
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
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={handleSystemFix}
            disabled={loading}
            variant="default"
            className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
          >
            {loading ? "Corrigindo..." : "🚨 CORREÇÃO COMPLETA"}
          </Button>
          
          <Button 
            onClick={handleManualProcess}
            disabled={loading}
            variant="outline"
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
            <li className="text-red-600">❌ Conversas bloqueadas (status sent_to_seller com fallback_mode)</li>
            <li className="text-red-600">❌ 10+ mensagens pendentes há dias</li>
            <li className="text-red-600">❌ Cron job não está executando de fato</li>
            <li className="text-red-600">❌ Dify não está recebendo mensagens</li>
          </ul>
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-red-700 dark:text-red-300 font-semibold">
              🚨 AÇÃO NECESSÁRIA: Clique em "CORREÇÃO COMPLETA" para resolver todos os problemas
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}