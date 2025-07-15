import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Lead {
  id: string;
  customer_name: string;
  phone_number: string;
  seller_id: string;
  seller_name?: string;
  product_interest: string | null;
  summary: string | null;
  sent_at: string | null;
  status: string | null;
  generated_sale: boolean | null;
  sale_value: number | null;
  conversation_id: string | null;
  ai_evaluation: string | null;
}

export function useLeads() {
  const { toast } = useToast();

  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          sellers (
            id,
            name
          )
        `)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      return data.map(lead => ({
        ...lead,
        seller_name: lead.sellers?.name || 'Vendedor não encontrado'
      })) as Lead[];
    },
  });

  return {
    leads,
    isLoading,
    error
  };
}

export function useMarkSale() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ leadId, saleValue }: { leadId: string; saleValue?: number }) => {
      const { error } = await supabase
        .from('leads')
        .update({
          status: 'sold',
          generated_sale: true,
          sale_value: saleValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: "Venda Marcada",
        description: "Lead marcado como venda realizada com sucesso",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao marcar venda: " + error.message,
        variant: "destructive"
      });
    }
  });
}

export function useLeadStats(leads: Lead[]) {
  return {
    total: leads.length,
    sold: leads.filter(l => l.status === 'sold').length,
    attending: leads.filter(l => l.status === 'attending').length,
    conversionRate: leads.length > 0 
      ? Math.round((leads.filter(l => l.generated_sale).length / leads.length) * 100)
      : 0,
    totalValue: leads
      .filter(l => l.generated_sale && l.sale_value)
      .reduce((sum, l) => sum + (l.sale_value || 0), 0),
    avgTicket: (() => {
      const soldLeads = leads.filter(l => l.generated_sale && l.sale_value);
      return soldLeads.length > 0 
        ? Math.round(soldLeads.reduce((sum, l) => sum + (l.sale_value || 0), 0) / soldLeads.length)
        : 0;
    })()
  };
}