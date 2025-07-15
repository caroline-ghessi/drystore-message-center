import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type ClientType = Tables<"client_types">;

export function useClientTypes() {
  return useQuery({
    queryKey: ["client_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_types")
        .select("*")
        .eq("active", true)
        .order("name");
        
      if (error) throw error;
      return data as ClientType[];
    },
  });
}