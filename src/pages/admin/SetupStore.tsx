import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import cartlyLogo from "@/assets/cartly-logo.png";

export default function SetupStore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [storeCategory, setStoreCategory] = useState("");

  useEffect(() => {
    // If user already has a slug or is super admin, they shouldn't be here
    const checkSlug = async () => {
      if (!user) return;
      
      const SUPER_ADMIN_EMAIL = "evelynesantoscruivinel@gmail.com";
      if (user.email === SUPER_ADMIN_EMAIL) {
        navigate("/superadmin");
        return;
      }

      const { data } = await supabase
        .from("store_settings")
        .select("store_slug")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data?.store_slug) {
        navigate("/admin");
      }
    };
    checkSlug();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const slug = storeSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!slug) {
        toast.error("Defina um slug válido para sua loja.");
        setLoading(false);
        return;
      }
      if (!storeCategory) {
        toast.error("Escolha o nicho da sua loja.");
        setLoading(false);
        return;
      }

      // Check if slug is taken
      const { data: existingSlug } = await supabase
        .from("store_settings")
        .select("id")
        .eq("store_slug", slug)
        .maybeSingle();

      if (existingSlug) {
        toast.error("Este slug já está em uso. Escolha outro.");
        setLoading(false);
        return;
      }

      // Update store settings
      const { error } = await supabase
        .from("store_settings")
        .upsert({
          user_id: user.id,
          store_name: storeName.trim(),
          store_slug: slug,
          store_category: storeCategory,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast.success("Loja configurada com sucesso!");
      navigate("/admin");
    } catch (error: any) {
      toast.error(error.message || "Erro ao configurar loja");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="absolute -inset-[2px] rounded-2xl overflow-hidden">
          <div
            className="absolute inset-0 animate-spin"
            style={{
              background: "conic-gradient(from 0deg, #3b82f6, #60a5fa, #93c5fd, #2563eb, #1d4ed8, #3b82f6)",
              animationDuration: "3s",
            }}
          />
        </div>
        <Card className="relative w-full border-0 shadow-2xl rounded-2xl bg-card z-10">
          <CardHeader className="text-center space-y-4 pt-8">
            <img src={cartlyLogo} alt="Cartly" className="mx-auto h-20 w-auto drop-shadow-lg" />
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Configure sua Loja
            </CardTitle>
            <CardDescription>
              Estamos quase lá! Complete os dados da sua loja para começar a vender.
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Nome da Loja</Label>
                <Input 
                  id="storeName" 
                  value={storeName} 
                  onChange={(e) => setStoreName(e.target.value)} 
                  placeholder="Ex: Moda Fashion" 
                  required 
                  className="h-11 border-border/50 focus:border-blue-500 transition-colors" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeCategory">Nicho da Loja</Label>
                <Select value={storeCategory} onValueChange={setStoreCategory}>
                  <SelectTrigger id="storeCategory" className="h-11 border-border/50 focus:border-blue-500 transition-colors">
                    <SelectValue placeholder="Selecione o nicho da sua loja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Doceria">🍰 Doceria</SelectItem>
                    <SelectItem value="Moda">👗 Moda</SelectItem>
                    <SelectItem value="Pet Shop">🐾 Pet Shop</SelectItem>
                    <SelectItem value="Eletrônicos">📱 Eletrônicos</SelectItem>
                    <SelectItem value="Alimentação">🍴 Alimentação</SelectItem>
                    <SelectItem value="Beleza">💄 Beleza</SelectItem>
                    <SelectItem value="Infantil">🧸 Infantil</SelectItem>
                    <SelectItem value="Joalheria">💍 Joalheria</SelectItem>
                    <SelectItem value="Outros">⚙️ Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeSlug">URL da Loja (slug)</Label>
                <div className="flex items-center gap-0">
                  <span className="inline-flex h-11 items-center rounded-l-md border border-r-0 border-border/50 bg-muted px-3 text-xs text-muted-foreground">/loja/</span>
                  <Input 
                    id="storeSlug" 
                    value={storeSlug} 
                    onChange={(e) => setStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} 
                    placeholder="moda-fashion" 
                    required 
                    className="h-11 rounded-l-none border-border/50 focus:border-blue-500 transition-colors" 
                  />
                </div>
                <p className="text-xs text-muted-foreground">Esse será o endereço da sua loja online</p>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-blue-500/40"
                disabled={loading}
              >
                {loading ? "Configurando..." : "Finalizar Cadastro"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
