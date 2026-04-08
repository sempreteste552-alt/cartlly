import { useState, useRef } from "react";
import { useProductReviews, useAverageRating, useCreateReview } from "@/hooks/useProductReviews";
import { StarRating } from "./StarRating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageSquare, User, ImagePlus, X, ZoomIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProductReviewsProps {
  productId: string;
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const { data: reviews, isLoading } = useProductReviews(productId);
  const { average, count } = useAverageRating(reviews);
  const createReview = useCreateReview();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateVideoDuration = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        if (video.duration > 10) {
          toast.error("Vídeo deve ter no máximo 10 segundos");
          resolve(false);
        } else {
          resolve(true);
        }
      };
      video.onerror = () => { URL.revokeObjectURL(video.src); resolve(false); };
      video.src = URL.createObjectURL(file);
    });
  };

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (imageFiles.length + files.length > 2) {
      toast.error("Máximo de 2 arquivos por avaliação");
      return;
    }
    const validated: File[] = [];
    for (const f of files) {
      const isImage = f.type.startsWith("image/");
      const isVideo = f.type.startsWith("video/");
      if (!isImage && !isVideo) { toast.error("Apenas imagens e vídeos são permitidos"); continue; }
      if (isImage && f.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB"); continue; }
      if (isVideo && f.size > 20 * 1024 * 1024) { toast.error("Vídeo deve ter no máximo 20MB"); continue; }
      if (isVideo && !(await validateVideoDuration(f))) continue;
      validated.push(f);
    }
    if (validated.length === 0) { if (fileInputRef.current) fileInputRef.current.value = ""; return; }
    setImageFiles((prev) => [...prev, ...validated].slice(0, 2));
    validated.forEach((f) => {
      if (f.type.startsWith("video/")) {
        setImagePreviews((prev) => [...prev, URL.createObjectURL(f)].slice(0, 2));
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreviews((prev) => [...prev, ev.target?.result as string].slice(0, 2));
        reader.readAsDataURL(f);
      }
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadImages = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of imageFiles) {
      const ext = file.name.split(".").pop();
      const path = `reviews/${productId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error("Informe seu nome");
    if (rating === 0) return toast.error("Selecione uma avaliação");
    if (name.length > 100 || comment.length > 1000) return toast.error("Texto muito longo");

    try {
      setUploading(true);
      const imageUrls = imageFiles.length > 0 ? await uploadImages() : [];

      createReview.mutate(
        {
          product_id: productId,
          customer_name: name.trim(),
          customer_email: email.trim() || undefined,
          rating,
          comment: comment.trim() || undefined,
          image_urls: imageUrls,
        },
        {
          onSuccess: () => {
            toast.success("Avaliação enviada!");
            setShowForm(false);
            setName("");
            setEmail("");
            setRating(0);
            setComment("");
            setImageFiles([]);
            setImagePreviews([]);
            setUploading(false);
          },
          onError: () => { toast.error("Erro ao enviar avaliação"); setUploading(false); },
        }
      );
    } catch {
      toast.error("Erro ao enviar imagens");
      setUploading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="mt-10">
      <Separator />
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Avaliações</h2>
            {count > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <StarRating rating={Math.round(average)} size={18} />
                <span className="text-sm text-gray-500">
                  {average.toFixed(1)} ({count} {count === 1 ? "avaliação" : "avaliações"})
                </span>
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
            <MessageSquare className="h-4 w-4 mr-1" /> Avaliar
          </Button>
        </div>

        {showForm && (
          <div className="border rounded-lg p-4 mb-6 space-y-3 bg-gray-50">
            <p className="font-medium text-sm">Deixe sua avaliação</p>
            <StarRating rating={rating} interactive onChange={setRating} size={28} />
            <Input placeholder="Seu nome *" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            <Input placeholder="E-mail (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
            <Textarea placeholder="Comentário (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} />

            {/* Image upload */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageFiles.length >= 2}
                >
                  <ImagePlus className="h-4 w-4 mr-1" />
                  Adicionar Foto ({imageFiles.length}/2)
                </Button>
                <span className="text-xs text-muted-foreground">Máx. 2 fotos, 5MB cada</span>
              </div>
              {imagePreviews.length > 0 && (
                <div className="flex gap-2">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden border">
                      <img src={src} alt={`Preview ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={createReview.isPending || uploading} className="bg-black text-white hover:bg-gray-800">
                {uploading || createReview.isPending ? "Enviando..." : "Enviar"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-400">Carregando avaliações...</p>
        ) : !reviews || reviews.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma avaliação ainda. Seja o primeiro!</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-sm">{r.customer_name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                </div>
                <StarRating rating={r.rating} size={16} />
                {r.comment && <p className="text-sm text-gray-600 mt-2">{r.comment}</p>}
                {r.image_urls && r.image_urls.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {r.image_urls.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setZoomImage(url)}
                        className="relative h-20 w-20 rounded-lg overflow-hidden border hover:opacity-90 transition-opacity group"
                      >
                        <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                          <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zoom dialog */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-lg p-1">
          {zoomImage && <img src={zoomImage} alt="Review" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}