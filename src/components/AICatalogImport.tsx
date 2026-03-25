import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Check, Package, ImagePlus, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [catalogText, setCatalogText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [products, setProducts] = useState<ExtractedProduct[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"input" | "review">("input");
  const [inputMode, setInputMode] = useState<"text" | "image">("text");

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imageFiles.length > 10) {
      toast.error("Máximo de 10 imagens");
      return;
    }
    const validFiles = files.filter((f) => {
      if (!f.type.startsWith("image/")) { toast.error(`${f.name} não é uma imagem`); return false; }
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name} excede 20MB`); return false; }
      return true;
    });

    setImageFiles((prev) => [...prev, ...validFiles]);
    validFiles.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (inputMode === "text" && !catalogText.trim()) return toast.error("Cole o texto do catálogo");
    if (inputMode === "image" && imagePreviews.length === 0) return toast.error("Adicione ao menos uma imagem");
    setAnalyzing(true);

    try {
      const body: any = { existingCategories: categories?.map((c) => c.name) ?? [] };

      if (inputMode === "text") {
        body.catalogText = catalogText.trim();
      } else {
        body.catalogImages = imagePreviews; // base64 data URLs
      }

      const { data, error } = await supabase.functions.invoke("ai-catalog", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const extracted = (data?.products || []).map((p: any) => ({ ...p, selected: true }));
      if (extracted.length === 0) { toast.error("Nenhum produto encontrado"); return; }
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
    setProducts((prev) => prev.map((p, idx) => (idx === i ? { ...p, selected: !p.selected } : p)));
  };

  const handleImport = async () => {
    const selected = products.filter((p) => p.selected);
    if (selected.length === 0) return toast.error("Selecione ao menos um produto");
    setImporting(true);

    try {
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
      resetState();
      window.location.reload();
    } catch (err: any) {
      toast.error("Erro ao importar: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const resetState = () => {
    setStep("input");
    setCatalogText("");
    setProducts([]);
    setImageFiles([]);
    setImagePreviews([]);
  };

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
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
              Cole um texto ou envie imagens do seu catálogo. A IA irá escanear e extrair os produtos automaticamente.
            </p>

            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "text" | "image")}>
              <TabsList className="w-full">
                <TabsTrigger value="text" className="flex-1 gap-2">
                  <FileText className="h-4 w-4" /> Texto
                </TabsTrigger>
                <TabsTrigger value="image" className="flex-1 gap-2">
                  <ImagePlus className="h-4 w-4" /> Imagem
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-2 mt-4">
                <Label>Texto do Catálogo</Label>
                <Textarea
                  value={catalogText}
                  onChange={(e) => setCatalogText(e.target.value)}
                  placeholder={`Exemplo:\nCamiseta Básica Preta - R$ 49,90 - Tam P, M, G\nCalça Jeans Slim - R$ 129,90 - Estoque: 25`}
                  rows={10}
                  maxLength={10000}
                />
                <p className="text-xs text-muted-foreground">{catalogText.length}/10000 caracteres</p>
              </TabsContent>

              <TabsContent value="image" className="space-y-4 mt-4">
                <Label>Imagens do Catálogo (máx. 10)</Label>
                <p className="text-xs text-muted-foreground">
                  Aceita JPG, PNG, WebP, HEIC, BMP, GIF, TIFF — até 20MB por imagem. Envie fotos de cardápios, tabelas, catálogos impressos ou screenshots.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff,image/heic,image/heif,image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />

                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-border">
                        <img src={src} alt={`Catálogo ${i + 1}`} className="w-full h-32 object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {imagePreviews.length < 10 && (
                  <Button
                    variant="outline"
                    className="w-full border-dashed h-20"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="mr-2 h-5 w-5" />
                    Adicionar Imagens
                  </Button>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || (inputMode === "text" ? !catalogText.trim() : imagePreviews.length === 0)}
              >
                {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {analyzing ? "Escaneando..." : "Analisar com IA"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {products.filter((p) => p.selected).length} de {products.length} produtos selecionados.
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
