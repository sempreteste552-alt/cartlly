import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, ImagePlus, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateCategoryImage } from "@/hooks/useCategories";
import { toast } from "sonner";

interface CategoryImageRowProps {
  category: { id: string; name: string; image_url?: string | null };
  onDelete: () => void;
}

export function CategoryImageRow({ category, onDelete }: CategoryImageRowProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const updateImage = useUpdateCategoryImage();

  const handleFile = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      let toUpload: File | Blob = file;
      if (file.size > 1024 * 300) {
        try {
          toUpload = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 600, useWebWorker: true });
        } catch {
          /* keep original */
        }
      }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/categories/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("store-assets")
        .upload(path, toUpload, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
      await updateImage.mutateAsync({ id: category.id, imageUrl: data.publicUrl });
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Enviar imagem da categoria"
        className="relative h-11 w-11 shrink-0 rounded-full overflow-hidden border-2 border-primary/40 bg-muted flex items-center justify-center"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : category.image_url ? (
          <img src={category.image_url} alt={category.name} className="h-full w-full object-cover" />
        ) : (
          <Tag className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <span className="text-sm flex-1 truncate">{category.name}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        title="Trocar imagem"
      >
        <ImagePlus className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
