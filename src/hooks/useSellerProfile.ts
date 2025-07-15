import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Seller = Tables<"sellers">;
type SellerSkill = Tables<"seller_skills">;
type SellerSpecialty = Tables<"seller_specialties">;
type SellerInsert = TablesInsert<"sellers">;
type SellerUpdate = TablesUpdate<"sellers">;

export function useSellerProfile(sellerId?: string) {
  return useQuery({
    queryKey: ["seller_profile", sellerId],
    queryFn: async () => {
      if (!sellerId) return null;
      
      const { data, error } = await supabase
        .from("sellers")
        .select(`
          *,
          seller_skills (*),
          seller_specialties (
            *,
            product_categories (*)
          )
        `)
        .eq("id", sellerId)
        .single();
        
      if (error) throw error;
      return data;
    },
    enabled: !!sellerId,
  });
}

export function useCreateSeller() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sellerData: SellerInsert) => {
      const { data, error } = await supabase
        .from("sellers")
        .insert(sellerData)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sellers"] });
    },
  });
}

export function useUpdateSeller() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: SellerUpdate & { id: string }) => {
      const { data: updatedSeller, error } = await supabase
        .from("sellers")
        .update(data)
        .eq("id", id)
        .select()
        .single();
        
      if (error) throw error;
      return updatedSeller;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sellers"] });
      queryClient.invalidateQueries({ queryKey: ["seller_profile", variables.id] });
    },
  });
}

export function useUpdateSellerSkills() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sellerId, skills }: { sellerId: string; skills: Omit<SellerSkill, 'id' | 'seller_id' | 'created_at' | 'updated_at'>[] }) => {
      // Delete existing skills
      await supabase
        .from("seller_skills")
        .delete()
        .eq("seller_id", sellerId);
        
      // Insert new skills
      const { data, error } = await supabase
        .from("seller_skills")
        .insert(skills.map(skill => ({ ...skill, seller_id: sellerId })));
        
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seller_profile", variables.sellerId] });
    },
  });
}

export function useUpdateSellerSpecialties() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sellerId, specialties }: { sellerId: string; specialties: { product_category_id: string; expertise_level: string }[] }) => {
      // Delete existing specialties
      await supabase
        .from("seller_specialties")
        .delete()
        .eq("seller_id", sellerId);
        
      // Insert new specialties
      const { data, error } = await supabase
        .from("seller_specialties")
        .insert(specialties.map(specialty => ({ ...specialty, seller_id: sellerId })));
        
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seller_profile", variables.sellerId] });
    },
  });
}