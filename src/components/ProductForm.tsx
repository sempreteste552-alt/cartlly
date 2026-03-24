import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, X, Loader2 } from "lucide-react";
import { useUploadProductImage, type Product } from "@/hooks/useProducts";

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
  }) => void;
  initialData?: Product | null;
  loading?: boolean;
}

export function ProductForm({ open, onOpenChange, onSubmit, initialData, loading }: ProductFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [price, setPrice] = useState(initialData?.price?.toString() ?? "");
  const [stock, setStock] = useState(initialData?.stock?.toString() ?? "0");
  const [imageUrl, setImageUrl] = useState(initialData?.image_url ?? "");
  const [published, setPublished] = useState(initialData?.published ?? false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadProductImage();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      return alert("Arquivo muito grande. Máximo 5MB.");
    }
    const url = await uploadImage.mutateAsync(file);
    setImageUrl(url);
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
    });
  };

  // Reset form when dialog opens with new data
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && !initialData) {
      setName("");
      setDescription("");
      setPrice("");
      setStock("0");
      setImageUrl("");
      setPublished(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
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
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Descrição do produto" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$) *</Label>
              <Input id="price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">Estoque *</Label>
              <Input id="stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} required placeholder="0" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Imagem</Label>
            {imageUrl ? (
              <div className="relative inline-block">
                <img src={imageUrl} alt="Preview" className="h-32 w-32 rounded-lg object-cover border border-border" />
                <button type="button" onClick={() => setImageUrl("")} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className="flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors"
              >
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
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
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
