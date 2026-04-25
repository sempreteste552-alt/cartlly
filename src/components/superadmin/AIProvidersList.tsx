import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Eye, EyeOff, Save, CheckCircle2, Play } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function AIProvidersList() {
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const handleTestConnection = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-tenant-actions", {
        body: { action: "test_ai_provider", providerId }
      });

      if (error) throw error;
      if (data.success) {
        toast.success(data.message || "Conexão estabelecida com sucesso!");
      } else {
        toast.error(`Falha na conexão: ${data.error || "Erro desconhecido"}`);
      }
    } catch (e: any) {
      toast.error(`Erro ao testar: ${e.message}`);
    } finally {
      setTestingProvider(null);
    }
  };

  const { data: providers, isLoading } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_providers")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: async (variables: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("ai_providers")
        .update(variables.updates)
        .eq("id", variables.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      toast.success("Provedor atualizado com sucesso");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const createProviderMutation = useMutation({
    mutationFn: async (newProvider: any) => {
      const { error } = await supabase
        .from("ai_providers")
        .insert([newProvider]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      toast.success("Provedor adicionado com sucesso");
      setIsAdding(false);
    },
    onError: (error) => {
      toast.error(`Erro ao adicionar: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Provedores de IA</h3>
        <Button onClick={() => setIsAdding(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Provedor
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {providers?.map((provider) => (
          <Card key={provider.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{provider.name}</CardTitle>
                  <CardDescription>Configurações globais de API</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={provider.is_active} 
                    onCheckedChange={(checked) => updateProviderMutation.mutate({ id: provider.id, updates: { is_active: checked } })}
                  />
                  <Badge variant={provider.is_active ? "default" : "secondary"}>
                    {provider.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-primary"
                    onClick={() => handleTestConnection(provider.id)}
                    disabled={testingProvider === provider.id}
                    title="Testar Conexão"
                  >
                    {testingProvider === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input 
                    type={showKey === provider.id ? "text" : "password"} 
                    value={provider.api_key} 
                    readOnly 
                    className="bg-muted"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setShowKey(showKey === provider.id ? null : provider.id)}
                  >
                    {showKey === provider.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Modelo Default</Label>
                  <p className="text-sm font-medium">{provider.model_text_default || "Não definido"}</p>
                </div>
                <div className="space-y-2">
                  <Label>Modelo Imagem</Label>
                  <p className="text-sm font-medium">{provider.model_image_default || "Não definido"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Custo por Texto (1k tokens)</p>
                  <p className="text-sm">R$ {provider.cost_per_text_token || "0,00"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Custo por Imagem</p>
                  <p className="text-sm">R$ {provider.cost_per_image || "0,00"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Provedor de IA</DialogTitle>
            <DialogDescription>
              Configure um novo provedor (OpenAI, Gemini, Anthropic, etc.)
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4 py-4" onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createProviderMutation.mutate({
              name: formData.get("name"),
              api_key: formData.get("api_key"),
              model_text_default: formData.get("model_text_default"),
              model_image_default: formData.get("model_image_default"),
              cost_per_text_token: parseFloat(formData.get("cost_per_text_token") as string || "0"),
              cost_per_image: parseFloat(formData.get("cost_per_image") as string || "0"),
              is_active: true
            });
          }}>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Provedor</Label>
                <Input id="name" name="name" placeholder="Ex: OpenAI" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <Input id="api_key" name="api_key" type="password" placeholder="sk-..." required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model_text_default">Modelo Texto</Label>
                  <Input id="model_text_default" name="model_text_default" placeholder="gpt-4o" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model_image_default">Modelo Imagem</Label>
                  <Input id="model_image_default" name="model_image_default" placeholder="dall-e-3" />
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={createProviderMutation.isPending}>
                {createProviderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Provedor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
