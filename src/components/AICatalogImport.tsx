import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Check, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories, useCreateCategory } from "@/hooks/useCategories";
import { useCreateProduct } from "@/hooks/useProducts";
import { toast } from "sonner";

interface AICatalogImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExtractedProduct {
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  selected: boolean;
}

export function AICatalogImport({ open, onOpenChange }: AICatalogImportProps) {
  const { user } = useAuth();
  const { data: categories } = useCategories();
  const createCategory = useCreateCategory();
  const createProduct = useCreateProduct();

  const [catalogText, setCatalogText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [products, setProducts] = useState<ExtractedProduct[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"input" | "review">("input");

  const handleAnalyze = async () => {
    if (!catalogText.trim()) return toast.error("Cole o texto do catálogo");
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-catalog", {
        body: {
          catalogText: catalogText.trim(),
          existingCategories: categories?.map((c) => c.name) ?? [],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const extracted = (data?.products || []).map((p: any) => ({ ...p, selected: true }));
      if (extracted.length === 0) {
        toast.error("Nenhum produto encontrado no texto");
        return;
      }
      setProducts(extracted);
      setStep("review");
      toast.success(`${extracted.length} produtos encontrados!`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao analisar catálogo");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleProduct = (i: number) => {
    setProducts((prev) => prev.map((p, idx) => idx === i ? { ...p, selected: !p.selected } : p));
  };

  const handleImport = async () => {
    const selected = products.filter((p) => p.selected);
    if (selected.length === 0) return toast.error("Selecione ao menos um produto");
    setImporting(true);

    try {
      // Create missing categories
      const existingCatNames = categories?.map((c) => c.name.toLowerCase()) ?? [];
      const newCategories = [...new Set(selected.map((p) => p.category))].filter(
        (c) => !existingCatNames.includes(c.toLowerCase())
      );

      const catMap: Record<string, string> = {};
      categories?.forEach((c) => { catMap[c.name.toLowerCase()] = c.id; });

      for (const catName of newCategories) {
        const { data, error } = await supabase
          .from("categories")
          .insert({ name: catName, user_id: user!.id })
          .select()
          .single();
        if (!error && data) catMap[catName.toLowerCase()] = data.id;
      }

      // Create products
      let created = 0;
      for (const p of selected) {
        const categoryId = catMap[p.category.toLowerCase()] || null;
        const { error } = await supabase.from("products").insert({
          name: p.name,
          description: p.description,
          price: p.price,
          stock: p.stock,
          category_id: categoryId,
          user_id: user!.id,
          published: true,
        });
        if (!error) created++;
      }

      toast.success(`${created} produtos importados com sucesso!`);
      onOpenChange(false);
      setStep("input");
      setCatalogText("");
      setProducts([]);
      // Refresh queries
      window.location.reload();
    } catch (err: any) {
      toast.error("Erro ao importar: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setStep("input"); setProducts([]); } onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar com IA
          </DialogTitle>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cole o texto do seu catálogo (lista de produtos, planilha copiada, descrição em texto livre).
              A IA irá analisar e extrair os produtos automaticamente.
            </p>
            <div className="space-y-2">
              <Label>Texto do Catálogo</Label>
              <Textarea
                value={catalogText}
                onChange={(e) => setCatalogText(e.target.value)}
                placeholder={`Exemplo:\nCamiseta Básica Preta - R$ 49,90 - Tam P, M, G\nCalça Jeans Slim - R$ 129,90 - Estoque: 25\nTênis Runner Pro - R$ 299,00 - Esportivo`}
                rows={10}
                maxLength={10000}
              />
              <p className="text-xs text-muted-foreground">{catalogText.length}/10000 caracteres</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleAnalyze} disabled={analyzing || !catalogText.trim()}>
                {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Analisar com IA
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {products.filter((p) => p.selected).length} de {products.length} produtos selecionados para importação.
            </p>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {products.map((product, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    product.selected ? "border-primary bg-primary/5" : "border-border opacity-60"
                  }`}
                  onClick={() => toggleProduct(i)}
                >
                  <div className={`mt-0.5 h-5 w-5 rounded flex items-center justify-center shrink-0 ${
                    product.selected ? "bg-primary text-primary-foreground" : "border border-border"
                  }`}>
                    {product.selected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{product.name}</p>
                      <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{formatPrice(product.price)}</span>
                      <span>Estoque: {product.stock}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("input")}>Voltar</Button>
              <Button onClick={handleImport} disabled={importing || products.filter((p) => p.selected).length === 0}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                Importar {products.filter((p) => p.selected).length} Produtos
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
