import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, X, Loader2, Video } from "lucide-react";
import { useUploadProductImage, type Product } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { AIProductTools } from "@/components/AIProductTools";
import { useProductImages } from "@/hooks/useProductImages";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess, getMaxProductImages } from "@/lib/planPermissions";

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description: string;
    price: number;
    stock: number;
    image_url: string | null;
    published: boolean;
    category_id: string | null;
    made_to_order: boolean;
    badge?: string | null;
    additionalImages?: string[];
    cost_price?: number;
    min_stock_alert?: number;
    is_prize?: boolean;
  }) => void;
  initialData?: Product | null;
  loading?: boolean;
}

export function ProductForm({ open, onOpenChange, onSubmit, initialData, loading }: ProductFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [imageUrl, setImageUrl] = useState("");
  const [published, setPublished] = useState(false);
  const [madeToOrder, setMadeToOrder] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [badge, setBadge] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [minStockAlert, setMinStockAlert] = useState("5");
  const [isPrize, setIsPrize] = useState(false);
  const [additionalVideos, setAdditionalVideos] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const additionalFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadProductImage();
  const { data: categories } = useCategories();
  const { ctx, role } = useTenantContext();
  const isViewer = role === "viewer";
  const aiLocked = !canAccess("ai_tools", ctx);
  const canVideo = canAccess("product_video", ctx);
  const maxImages = getMaxProductImages(ctx);

  // Load existing additional images when editing
  const { data: existingImages } = useProductImages(initialData?.id);

  // Sync form state when initialData changes (fixes edit resetting data)
  useEffect(() => {
    if (initialData) {
      setName(initialData.name ?? "");
      setDescription(initialData.description ?? "");
      setPrice(initialData.price?.toString() ?? "");
      setStock(initialData.stock?.toString() ?? "0");
      setImageUrl(initialData.image_url ?? "");
      setPublished(initialData.published ?? false);
      setMadeToOrder((initialData as any)?.made_to_order ?? false);
      setCategoryId(initialData.category_id ?? "");
      setBadge((initialData as any)?.badge ?? "");
      setCostPrice((initialData as any)?.cost_price?.toString() ?? "");
      setMinStockAlert((initialData as any)?.min_stock_alert?.toString() ?? "5");
      setIsPrize((initialData as any)?.is_prize ?? false);
    }
  }, [initialData]);

  // Load existing additional images & videos
  useEffect(() => {
    if (existingImages && existingImages.length > 0) {
      const imgs: string[] = [];
      const vids: string[] = [];
      existingImages.forEach((img: any) => {
        if (img.image_url?.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv)$/i)) {
          vids.push(img.image_url);
        } else {
          imgs.push(img.image_url);
        }
      });
      setAdditionalImages(imgs);
      setAdditionalVideos(vids);
    } else if (initialData) {
      setAdditionalImages([]);
      setAdditionalVideos([]);
    }
  }, [existingImages, initialData?.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return alert("Arquivo muito grande. Máximo 50MB.");
    const url = await uploadImage.mutateAsync(file);
    setImageUrl(url);
  };

  const handleAdditionalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (additionalImages.length + files.length > maxImages) {
      alert(`Máximo de ${maxImages} imagens adicionais no seu plano.`);
      return;
    }
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > 50 * 1024 * 1024) { alert(`${files[i].name} muito grande. Máximo 50MB.`); continue; }
      const url = await uploadImage.mutateAsync(files[i]);
      setAdditionalImages((prev) => [...prev, url]);
    }
    if (additionalFileRef.current) additionalFileRef.current.value = "";
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (additionalVideos.length + files.length > 4) {
      alert("Máximo de 4 vídeos.");
      return;
    }
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > 50 * 1024 * 1024) { alert(`${files[i].name} muito grande. Máximo 50MB.`); continue; }
      const url = await uploadImage.mutateAsync(files[i]);
      setAdditionalVideos((prev) => [...prev, url]);
    }
    if (videoFileRef.current) videoFileRef.current.value = "";
  };

  const removeVideo = (index: number) => {
    setAdditionalVideos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price) || 0,
      stock: parseInt(stock) || 0,
      image_url: imageUrl || null,
      published,
      category_id: categoryId || null,
      made_to_order: madeToOrder,
      badge: badge.trim() || null,
      additionalImages: [...additionalImages, ...additionalVideos],
      cost_price: parseFloat(costPrice) || 0,
      min_stock_alert: parseInt(minStockAlert) || 5,
      is_prize: isPrize,
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && !initialData) {
      setName(""); setDescription(""); setPrice(""); setStock("0");
      setImageUrl(""); setPublished(false); setMadeToOrder(false); setCategoryId(""); setBadge(""); setCostPrice(""); setMinStockAlert("5"); setAdditionalImages([]); setAdditionalVideos([]);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} placeholder="Nome do produto" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="Descrição do produto" rows={3} />
          </div>

          <AIProductTools
            name={name}
            description={description}
            price={price}
            category={categories?.find(c => c.id === categoryId)?.name || ""}
            imageUrl={imageUrl}
            onApplyDescription={setDescription}
            onApplyName={setName}
            onApplyPrice={setPrice}
            onApplyBadge={setBadge}
            locked={aiLocked}
          />

          <div className="space-y-2">
            <Label htmlFor="badge">Selo / Destaque (ex: A queridinha voltou!)</Label>
            <Input id="badge" value={badge} onChange={(e) => setBadge(e.target.value)} maxLength={50} placeholder="Frase curta de impacto" />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$) *</Label>
              <Input id="price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost_price">Custo (R$)</Label>
              <Input id="cost_price" type="number" step="0.01" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">Estoque *</Label>
              <Input id="stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} required placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_stock_alert">Alerta estoque mínimo</Label>
              <Input id="min_stock_alert" type="number" min="0" value={minStockAlert} onChange={(e) => setMinStockAlert(e.target.value)} placeholder="5" />
              <p className="text-xs text-muted-foreground">Notifica quando o estoque atingir essa quantidade</p>
            </div>
          </div>

          {/* Main Image */}
          <div className="space-y-2">
            <Label>Imagem Principal</Label>
            {imageUrl ? (
              <div className="relative inline-block">
                <img src={imageUrl} alt="Preview" className="h-32 w-32 rounded-lg object-cover border border-border" />
                <button type="button" onClick={() => setImageUrl("")} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()} className="flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors">
                {uploadImage.isPending ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="mt-1 text-xs text-muted-foreground">Clique para enviar</p>
                  </div>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept="*/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Additional Images */}
          {maxImages > 0 ? (
            <div className="space-y-2">
              <Label>Imagens Adicionais ({additionalImages.length}/{maxImages})</Label>
              <div className="grid grid-cols-4 gap-2">
                {additionalImages.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Extra ${i + 1}`} className="h-20 w-full rounded-md object-cover border border-border" />
                    <button type="button" onClick={() => removeAdditionalImage(i)} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {additionalImages.length < maxImages && (
                  <div
                    onClick={() => additionalFileRef.current?.click()}
                    className="flex h-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border hover:border-primary/50 transition-colors"
                  >
                    {uploadImage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
              <input ref={additionalFileRef} type="file" accept="*/*" multiple className="hidden" onChange={handleAdditionalFileChange} />
              <p className="text-xs text-muted-foreground">Aceita qualquer formato de imagem. Máx 50MB cada.</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-3">
              📸 Imagens adicionais disponíveis a partir do plano STARTER. Faça upgrade para adicionar mais fotos.
            </p>
          )}

          {/* Video Section - only for plans with product_video */}
          {canVideo && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Vídeos do Produto ({additionalVideos.length}/4)
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {additionalVideos.map((url, i) => (
                  <div key={i} className="relative group">
                    <div className="h-20 w-full rounded-md bg-black flex items-center justify-center border border-border">
                      <Video className="h-6 w-6 text-white" />
                    </div>
                    <button type="button" onClick={() => removeVideo(i)} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {additionalVideos.length < 4 && (
                  <div
                    onClick={() => videoFileRef.current?.click()}
                    className="flex h-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border hover:border-primary/50 transition-colors"
                  >
                    {uploadImage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <div className="text-center">
                        <Video className="mx-auto h-4 w-4 text-muted-foreground" />
                        <p className="mt-0.5 text-[10px] text-muted-foreground">Vídeo</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <input ref={videoFileRef} type="file" accept="video/*" multiple className="hidden" onChange={handleVideoFileChange} />
              <p className="text-xs text-muted-foreground">MP4, WebM, MOV. Máx 50MB cada.</p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="made_to_order" className="text-sm font-medium">Sob Encomenda</Label>
              <p className="text-xs text-muted-foreground">Produto vendido sob encomenda (não sai do ar quando estoque zera)</p>
            </div>
            <Switch id="made_to_order" checked={madeToOrder} onCheckedChange={setMadeToOrder} />
          </div>


          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="published" className="text-sm font-medium">Publicado</Label>
              <p className="text-xs text-muted-foreground">Produto visível na loja</p>
            </div>
            <Switch id="published" checked={published} onCheckedChange={setPublished} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading || uploadImage.isPending}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {initialData ? "Salvar" : "Criar Produto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
