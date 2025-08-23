import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, PlayCircle, CheckCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
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

        <div className="space-y-4">
          <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="font-semibold text-destructive">Sistema com Problemas Críticos</h3>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                <strong>PROBLEMA IDENTIFICADO:</strong> Sistema de mensagens travado com 400+ conversas paradas
              </p>
              <p className="text-muted-foreground">
                <strong>SOLUÇÃO IMPLEMENTADA:</strong> Processamento em lotes para evitar timeout
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Correção de constraints de auditoria do sistema</li>
                <li>Processamento de conversas em lotes de 50 (evita timeout)</li>
                <li>Reprocessamento de mensagens pendentes na fila</li>
                <li>Recriação do cron job para funcionamento automático</li>
              </ul>
            </div>
          </div>
          
          <div className="p-4 border border-primary/50 rounded-lg bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-primary">Correção Completa Melhorada</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              A correção agora processa conversas gradualmente para evitar erros de timeout.
              Monitore o progresso através dos logs detalhados.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}