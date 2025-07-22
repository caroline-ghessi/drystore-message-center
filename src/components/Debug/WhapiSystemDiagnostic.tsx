import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/integrations/supabase/client'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Settings, Phone, Bot, Users } from 'lucide-react'

interface DiagnosticResult {
  success: boolean
  diagnostics?: any
  summary?: any
  error?: string
}

export function WhapiSystemDiagnostic() {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<DiagnosticResult | null>(null)

  const runDiagnostic = async () => {
    setIsRunning(true)
    setResult(null)

    try {
      const { data, error } = await supabase.functions.invoke('diagnose-whapi-system')
      
      if (error) {
        setResult({ success: false, error: error.message })
      } else {
        setResult(data)
      }
    } catch (error) {
      setResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      })
    } finally {
      setIsRunning(false)
    }
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />
    }
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200'
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Diagnóstico Completo do Sistema WHAPI
        </CardTitle>
        <CardDescription>
          Validação completa de tokens, configurações e fluxo de mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostic} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executando Diagnóstico...
            </>
          ) : (
            'Executar Diagnóstico Completo'
          )}
        </Button>

        {result && (
          <div className="space-y-4">
            {result.success ? (
              <>
                {/* Resumo da Saúde do Sistema */}
                <Alert className={getHealthColor(result.summary?.system_health)}>
                  <div className="flex items-center gap-2">
                    {getHealthIcon(result.summary?.system_health)}
                    <AlertDescription className="font-medium">
                      Status do Sistema: {result.summary?.system_health?.toUpperCase()}
                      {result.summary?.total_issues > 0 && (
                        <span className="ml-2">({result.summary.total_issues} problemas encontrados)</span>
                      )}
                    </AlertDescription>
                  </div>
                </Alert>

                {/* Issues Encontrados */}
                {result.summary?.issues?.length > 0 && (
                  <Card className="bg-red-50 border-red-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-red-800 text-sm">Problemas Identificados</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ul className="space-y-1">
                        {result.summary.issues.map((issue: string, index: number) => (
                          <li key={index} className="text-sm text-red-700 flex items-center gap-2">
                            <XCircle className="h-4 w-4" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Diagnóstico do Rodrigo Bot */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Bot className="h-4 w-4" />
                      Rodrigo Bot (Comunicações Internas)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Token Existe:</span>
                        <Badge variant={result.diagnostics?.rodrigo_bot?.token_exists ? "default" : "destructive"} className="ml-2">
                          {result.diagnostics?.rodrigo_bot?.token_exists ? "Sim" : "Não"}
                        </Badge>
                      </div>
                      <div>
                        <span className="font-medium">Número Esperado:</span>
                        <span className="ml-2 font-mono">5551981155622</span>
                      </div>
                      <div>
                        <span className="font-medium">Número Real:</span>
                        <span className="ml-2 font-mono">
                          {result.diagnostics?.rodrigo_bot?.actual_phone || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Números Conferem:</span>
                        <Badge variant={result.diagnostics?.rodrigo_bot?.phone_matches ? "default" : "destructive"} className="ml-2">
                          {result.diagnostics?.rodrigo_bot?.phone_matches ? "Sim" : "Não"}
                        </Badge>
                      </div>
                    </div>
                    
                    {result.diagnostics?.rodrigo_bot?.validation_error && (
                      <Alert className="bg-red-50 border-red-200">
                        <AlertDescription className="text-red-700 text-sm">
                          Erro de validação: {result.diagnostics.rodrigo_bot.validation_error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Configurações WHAPI */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4" />
                      Configurações WHAPI ({result.diagnostics?.configurations?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {result.diagnostics?.configurations?.length > 0 ? (
                      <div className="space-y-3">
                        {result.diagnostics.configurations.map((config: any, index: number) => (
                          <div key={index} className="border rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{config.name}</span>
                              <div className="flex gap-2">
                                <Badge variant={config.active ? "default" : "secondary"}>
                                  {config.active ? "Ativo" : "Inativo"}
                                </Badge>
                                <Badge variant={config.token_exists ? "default" : "destructive"}>
                                  {config.token_exists ? "Token OK" : "Token Missing"}
                                </Badge>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <div>Tipo: {config.type}</div>
                              <div>Telefone: {config.phone_number}</div>
                              <div>Secret: {config.token_secret_name}</div>
                              <div>Status: {config.health_status}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Nenhuma configuração WHAPI encontrada</p>
                    )}
                  </CardContent>
                </Card>

                {/* Vendedores */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4" />
                      Vendedores Ativos ({result.diagnostics?.sellers?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {result.diagnostics?.sellers?.length > 0 ? (
                      <div className="space-y-3">
                        {result.diagnostics.sellers.map((seller: any, index: number) => (
                          <div key={index} className="border rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{seller.name}</span>
                              <div className="flex gap-2">
                                <Badge variant={seller.whapi_token === 'SET' ? "default" : "secondary"}>
                                  {seller.whapi_token === 'SET' ? "Token Próprio" : "Sem Token"}
                                </Badge>
                                <Badge variant={seller.auto_first_message ? "default" : "secondary"}>
                                  {seller.auto_first_message ? "Auto Msg" : "Manual"}
                                </Badge>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <div>Telefone: {seller.phone_number}</div>
                              <div>Status WHAPI: {seller.whapi_status}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Nenhum vendedor ativo encontrado</p>
                    )}
                  </CardContent>
                </Card>

                {/* Logs Recentes */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Logs Recentes (Últimos 10)</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {result.diagnostics?.recent_logs?.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {result.diagnostics.recent_logs.map((log: any, index: number) => (
                          <div key={index} className="text-xs border-l-2 border-gray-200 pl-3 py-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {log.direction}
                              </Badge>
                              <span className="font-mono">{log.phone_from} → {log.phone_to}</span>
                              <span className="text-gray-500">
                                {new Date(log.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            {log.content && (
                              <div className="mt-1 text-gray-600 truncate">
                                {log.content.substring(0, 50)}...
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Nenhum log encontrado</p>
                    )}
                  </CardContent>
                </Card>

                <Separator />
                
                <div className="text-xs text-gray-500">
                  Diagnóstico executado em: {new Date(result.diagnostics?.timestamp).toLocaleString('pt-BR')}
                </div>
              </>
            ) : (
              <Alert className="bg-red-50 border-red-200">
                <XCircle className="h-4 w-4" />
                <AlertDescription className="text-red-700">
                  Erro no diagnóstico: {result.error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}