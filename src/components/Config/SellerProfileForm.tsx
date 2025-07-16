import { useState } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useProductCategories } from "@/hooks/useProductCategories";
import { useClientTypes } from "@/hooks/useClientTypes";
import { useCreateSeller, useUpdateSeller, useUpdateSellerSkills, useUpdateSellerSpecialties } from "@/hooks/useSellerProfile";
import { useDeletedSellerByPhone, useRestoreSeller } from "@/hooks/useSellers";
import { RestoreSellerDialog } from "./RestoreSellerDialog";
import { User, Upload, Star, Target, Brain, Briefcase, X } from "lucide-react";

interface SellerProfileFormProps {
  sellerId?: string;
  initialData?: any;
  onSuccess?: () => void;
}

interface FormData {
  name: string;
  phone_number: string;
  email: string;
  bio: string;
  experience_years: number;
  personality_type: string;
  max_concurrent_leads: number;
  whapi_token: string;
  auto_first_message: boolean;
  avatar_url?: string;
}

export default function SellerProfileForm({ sellerId, initialData, onSuccess }: SellerProfileFormProps) {
  const { toast } = useToast();
  const form = useForm<FormData>({
    defaultValues: initialData || {
      name: "",
      phone_number: "",
      email: "",
      bio: "",
      experience_years: 0,
      personality_type: "consultivo",
      max_concurrent_leads: 10,
      whapi_token: "",
      auto_first_message: false,
    }
  });

  const [skills, setSkills] = useState<Array<{ skill_name: string; skill_type: string; proficiency_level: number; description: string }>>(
    initialData?.seller_skills || []
  );
  const [specialties, setSpecialties] = useState<Array<{ product_category_id: string; expertise_level: string }>>(
    initialData?.seller_specialties?.map((s: any) => ({ product_category_id: s.product_category_id, expertise_level: s.expertise_level })) || []
  );
  const [newSkill, setNewSkill] = useState({ skill_name: "", skill_type: "soft", proficiency_level: 3, description: "" });
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [deletedSeller, setDeletedSeller] = useState<any>(null);

  const { data: productCategories = [] } = useProductCategories();
  const { data: clientTypes = [] } = useClientTypes();
  const createSeller = useCreateSeller();
  const updateSeller = useUpdateSeller();
  const updateSkills = useUpdateSellerSkills();
  const updateSpecialties = useUpdateSellerSpecialties();
  const checkDeletedSeller = useDeletedSellerByPhone();
  const restoreSeller = useRestoreSeller();

  const addSkill = () => {
    if (newSkill.skill_name.trim()) {
      setSkills([...skills, { ...newSkill, description: newSkill.description || "" }]);
      setNewSkill({ skill_name: "", skill_type: "soft", proficiency_level: 3, description: "" });
    }
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const toggleSpecialty = (categoryId: string) => {
    const exists = specialties.find(s => s.product_category_id === categoryId);
    if (exists) {
      setSpecialties(specialties.filter(s => s.product_category_id !== categoryId));
    } else {
      setSpecialties([...specialties, { product_category_id: categoryId, expertise_level: "intermediate" }]);
    }
  };

  const updateSpecialtyLevel = (categoryId: string, level: string) => {
    setSpecialties(specialties.map(s => 
      s.product_category_id === categoryId ? { ...s, expertise_level: level } : s
    ));
  };

  const checkForDeletedSeller = async (phoneNumber: string) => {
    if (!phoneNumber || sellerId) return; // Skip if editing existing seller
    
    try {
      const deletedSellerData = await checkDeletedSeller.mutateAsync(phoneNumber);
      if (deletedSellerData) {
        setDeletedSeller(deletedSellerData);
        setShowRestoreDialog(true);
      }
    } catch (error) {
      console.error("Error checking for deleted seller:", error);
    }
  };

  const handleRestoreSeller = async () => {
    if (!deletedSeller) return;
    
    try {
      await restoreSeller.mutateAsync(deletedSeller.id);
      
      // Pre-fill form with existing data
      form.reset({
        name: deletedSeller.name,
        phone_number: deletedSeller.phone_number,
        email: deletedSeller.email || "",
        bio: deletedSeller.bio || "",
        experience_years: deletedSeller.experience_years || 0,
        personality_type: deletedSeller.personality_type || "consultivo",
        max_concurrent_leads: deletedSeller.max_concurrent_leads || 10,
        whapi_token: deletedSeller.whapi_token || "",
        auto_first_message: deletedSeller.auto_first_message || false,
        avatar_url: deletedSeller.avatar_url || "",
      });

      toast({
        title: "Vendedor Restaurado!",
        description: "O vendedor foi restaurado com sucesso. Você pode editar os dados se necessário.",
      });

      setShowRestoreDialog(false);
      setDeletedSeller(null);
    } catch (error) {
      console.error("Error restoring seller:", error);
      toast({
        title: "Erro",
        description: "Erro ao restaurar vendedor",
        variant: "destructive",
      });
    }
  };

  const handleCreateNewSeller = () => {
    setShowRestoreDialog(false);
    setDeletedSeller(null);
    // Keep current form data and allow user to proceed with new phone number
  };

  const onSubmit = async (data: FormData) => {
    // Check for deleted seller before creating new one
    if (!sellerId) {
      await checkForDeletedSeller(data.phone_number);
      if (showRestoreDialog) return; // Stop submission if restore dialog is shown
    }

    try {
      let sellerResult;
      
      if (sellerId) {
        sellerResult = await updateSeller.mutateAsync({ id: sellerId, ...data });
      } else {
        sellerResult = await createSeller.mutateAsync(data);
      }

      const finalSellerId = sellerId || sellerResult.id;

      // Update skills and specialties
      await Promise.all([
        updateSkills.mutateAsync({ sellerId: finalSellerId, skills }),
        updateSpecialties.mutateAsync({ sellerId: finalSellerId, specialties })
      ]);

      toast({
        title: "Sucesso!",
        description: sellerId ? "Perfil do vendedor atualizado" : "Vendedor cadastrado com sucesso",
      });

      onSuccess?.();
    } catch (error) {
      console.error("Error saving seller:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar vendedor",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          {/* Dados Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5 text-primary" />
                <span>Dados Pessoais</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
                <Avatar className="w-16 h-16 sm:w-12 sm:h-12">
                  <AvatarImage src={form.watch("avatar_url")} />
                  <AvatarFallback>
                    {form.watch("name")?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto h-10">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Foto
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: João Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="joao@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone/WhatsApp</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="experience_years"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Anos de Experiência</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">Biografia/Apresentação</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Conte um pouco sobre a experiência e especialidades do vendedor..." 
                        {...field} 
                        className="w-full min-h-[100px] sm:min-h-[120px] resize-y"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Especialidades em Produtos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-primary" />
                <span>Especialidades em Produtos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {productCategories.map((category) => {
                  const specialty = specialties.find(s => s.product_category_id === category.id);
                  const isSelected = !!specialty;
                  
                  return (
                    <div key={category.id} className="border rounded-lg p-3 space-y-2 min-h-[80px]">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">{category.name}</Label>
                        <Switch
                          checked={isSelected}
                          onCheckedChange={() => toggleSpecialty(category.id)}
                        />
                      </div>
                      {isSelected && (
                        <Select
                          value={specialty?.expertise_level}
                          onValueChange={(value) => updateSpecialtyLevel(category.id, value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="beginner">Iniciante</SelectItem>
                            <SelectItem value="intermediate">Intermediário</SelectItem>
                            <SelectItem value="advanced">Avançado</SelectItem>
                            <SelectItem value="expert">Especialista</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Habilidades */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-primary" />
                <span>Habilidades</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <Input
                  placeholder="Nome da habilidade"
                  value={newSkill.skill_name}
                  onChange={(e) => setNewSkill({...newSkill, skill_name: e.target.value})}
                  className="w-full h-10"
                />
                <Select
                  value={newSkill.skill_type}
                  onValueChange={(value) => setNewSkill({...newSkill, skill_type: value})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soft">Soft Skill</SelectItem>
                    <SelectItem value="technical">Técnica</SelectItem>
                    <SelectItem value="product">Produto</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={newSkill.proficiency_level.toString()}
                  onValueChange={(value) => setNewSkill({...newSkill, proficiency_level: parseInt(value)})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Nível 1</SelectItem>
                    <SelectItem value="2">Nível 2</SelectItem>
                    <SelectItem value="3">Nível 3</SelectItem>
                    <SelectItem value="4">Nível 4</SelectItem>
                    <SelectItem value="5">Nível 5</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  type="button" 
                  onClick={addSkill} 
                  variant="outline" 
                  className="w-full sm:w-auto h-10"
                >
                  Adicionar
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                    <span>{skill.skill_name}</span>
                    <span className="text-xs">({skill.proficiency_level}/5)</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => removeSkill(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Configurações de Trabalho */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <span>Configurações de Trabalho</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="personality_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm sm:text-base">Tipo de Personalidade</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="consultivo">Consultivo</SelectItem>
                          <SelectItem value="assertivo">Assertivo</SelectItem>
                          <SelectItem value="amigavel">Amigável</SelectItem>
                          <SelectItem value="analitico">Analítico</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_concurrent_leads"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm sm:text-base">Máximo de Leads Simultâneos</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          max="50" 
                          {...field} 
                          onChange={e => field.onChange(parseInt(e.target.value) || 10)}
                          className="h-10"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="whapi_token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm sm:text-base">Token WHAPI</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Token de integração WHAPI" 
                          {...field}
                          className="h-10"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center space-x-3 pt-6">
                  <FormField
                    control={form.control}
                    name="auto_first_message"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-sm sm:text-base">Primeira mensagem automática</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-2 pt-4 pb-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onSuccess?.()} 
              className="w-full sm:w-auto h-10"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createSeller.isPending || updateSeller.isPending}
              className="w-full sm:w-auto h-10"
            >
              {sellerId ? "Atualizar" : "Cadastrar"} Vendedor
            </Button>
          </div>
        </form>
      </Form>

      {deletedSeller && (
        <RestoreSellerDialog
          open={showRestoreDialog}
          onClose={() => setShowRestoreDialog(false)}
          onRestore={handleRestoreSeller}
          onCreateNew={handleCreateNewSeller}
          seller={deletedSeller}
        />
      )}
    </div>
  );
}