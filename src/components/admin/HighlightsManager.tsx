import { useState, useRef } from "react";
import imageCompression from "browser-image-compression";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Pencil, Image, Video, Star, X, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useStoreHighlights,
  useCreateHighlight,
  useUpdateHighlight,
  useDeleteHighlight,
  useAddHighlightItem,
  useDeleteHighlightItem,
  type StoreHighlight,
} from "@/hooks/useStoreHighlights";

async function uploadFile(file: File, folder: string, userId: string): Promise<string> {
  let fileToUpload = file;
  
  // Compress if it's an image and not too small already
  if (file.type.startsWith("image/") && file.size > 1024 * 500) { // > 500KB
    try {
      const options = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      };
      fileToUpload = await imageCompression(file, options);
    } catch (err) {
      console.error("Compression error:", err);
      // Fallback to original file if compression fails
    }
  }

  const ext = fileToUpload.name.split(".").pop() || "bin";
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("store-assets").upload(path, fileToUpload, { 
    upsert: true, 
    contentType: fileToUpload.type,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
  return data.publicUrl;
}

function FileUploadButton({
  label,
  accept,
  onUploaded,
  loading,
  setLoading,
  userId,
}: {
  label: string;
  accept: string;
  onUploaded: (url: string, type: "image" | "video") => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  userId: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading(true);
    const total = files.length;
    let done = 0;
    setUploadProgress({ done: 0, total });
    try {
      for (const file of Array.from(files)) {
        const url = await uploadFile(file, "highlights", userId);
        const type = file.type.startsWith("video") ? "video" : "image";
        onUploaded(url, type);
        done++;
        setUploadProgress({ done, total });
      }
      if (total > 1) toast.success(`${total} mídias enviadas com sucesso!`);
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setLoading(false);
      setUploadProgress(null);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input ref={ref} type="file" accept={accept} multiple className="hidden" onChange={handleChange} />
      <Button
        type="button"
        variant="outline"
        disabled={loading}
        onClick={() => ref.current?.click()}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {uploadProgress ? `${uploadProgress.done}/${uploadProgress.total}` : "Enviando..."}
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            {label}
          </>
        )}
      </Button>
    </>
  );
}

function HighlightEditor({ highlight, onClose, userId }: { highlight: StoreHighlight; onClose: () => void; userId: string }) {
  const updateHighlight = useUpdateHighlight();
  const addItem = useAddHighlightItem();
  const deleteItem = useDeleteHighlightItem();
  const [name, setName] = useState(highlight.name);
  const [coverUrl, setCoverUrl] = useState(highlight.cover_url || "");
  const [uploading, setUploading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaUrlInput, setMediaUrlInput] = useState("");

  const handleSave = () => {
    updateHighlight.mutate(
      { id: highlight.id, name: name.trim(), cover_url: coverUrl.trim() || null },
      { onSuccess: onClose }
    );
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, "highlights/covers", userId);
      setCoverUrl(url);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Nome do Destaque</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Última Edição" />
      </div>
      <div className="space-y-2">
        <Label>Capa do Destaque</Label>
        <div className="flex items-center gap-3">
          {coverUrl && (
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary shrink-0">
              <img src={coverUrl} alt="Capa" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              <div className="flex items-center gap-2 text-sm text-primary hover:underline">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {coverUrl ? "Trocar capa" : "Enviar capa"}
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Media items */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Mídias do Destaque</Label>
        {highlight.items && highlight.items.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {highlight.items
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <div key={item.id} className="relative group rounded-lg overflow-hidden border border-border aspect-square bg-muted">
                  {item.media_type === "video" ? (
                    <video src={item.media_url} className="w-full h-full object-cover" muted preload="metadata" />
                  ) : (
                    <img src={item.media_url} alt="" className="w-full h-full object-cover" />
                  )}
                  <Badge className="absolute top-1 left-1 text-[9px] px-1 py-0">
                    {item.media_type === "video" ? "Vídeo" : "Imagem"}
                  </Badge>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteItem.mutate(item.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
            Nenhuma mídia adicionada ainda
          </p>
        )}

        <div className="space-y-2">
          <FileUploadButton
            label="Enviar imagens ou vídeos"
            accept="image/*,video/*"
            loading={uploadingMedia}
            setLoading={setUploadingMedia}
            userId={userId}
            onUploaded={(url, type) => {
              addItem.mutate({
                highlight_id: highlight.id,
                media_type: type,
                media_url: url,
                sort_order: (highlight.items?.length || 0) * 10,
              });
            }}
          />
          <div className="flex gap-2">
            <Input
              value={mediaUrlInput}
              onChange={(e) => setMediaUrlInput(e.target.value)}
              placeholder="Ou cole URL da imagem/vídeo"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!mediaUrlInput.trim()) return;
                const type = mediaUrlInput.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv)$/i) ? "video" : "image";
                addItem.mutate({
                  highlight_id: highlight.id,
                  media_type: type,
                  media_url: mediaUrlInput.trim(),
                  sort_order: (highlight.items?.length || 0) * 10,
                });
                setMediaUrlInput("");
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={updateHighlight.isPending}>
          {updateHighlight.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}

export default function HighlightsManager() {
  const { user } = useAuth();
  const { data: highlights, isLoading } = useStoreHighlights();
  const createHighlight = useCreateHighlight();
  const deleteHighlight = useDeleteHighlight();
  const addItem = useAddHighlightItem();
  const [editing, setEditing] = useState<StoreHighlight | null>(null);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [createdHighlight, setCreatedHighlight] = useState<StoreHighlight | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverPreview, setCoverPreview] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadFile(file, "highlights/covers", user!.id);
      setCoverPreview(url);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createHighlight.mutate(
      { name: newName.trim(), cover_url: coverPreview || undefined },
      {
        onSuccess: (data) => {
          setCreatedHighlight(data);
          setStep(2);
        },
      }
    );
  };

  const resetCreate = () => {
    setShowCreate(false);
    setStep(1);
    setNewName("");
    setCoverPreview("");
    setCreatedHighlight(null);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Destaques (Stories)
          </h2>
          <p className="text-sm text-muted-foreground">Crie destaques estilo Instagram para o site</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo Destaque
        </Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => !o && resetCreate()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{step === 1 ? "Novo Destaque" : "Adicionar Mídias"}</DialogTitle>
          </DialogHeader>

          {step === 1 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Destaque</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Última Edição" />
              </div>
              <div className="space-y-2">
                <Label>Capa (opcional)</Label>
                <label className="cursor-pointer block">
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
                  <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors">
                    {uploadingCover ? (
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    ) : coverPreview ? (
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary mx-auto">
                        <img src={coverPreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Upload className="h-6 w-6" />
                        <span className="text-sm">Clique para enviar a capa</span>
                      </div>
                    )}
                  </div>
                </label>
              </div>
              <Button onClick={handleCreate} disabled={!newName.trim() || createHighlight.isPending} className="w-full">
                {createHighlight.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar e Adicionar Mídias
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Envie imagens ou vídeos ao destaque <strong>{createdHighlight?.name}</strong>.</p>
              <FileUploadButton
                label="Enviar imagens ou vídeos"
                accept="image/*,video/*"
                loading={uploadingMedia}
                setLoading={setUploadingMedia}
                userId={user!.id}
                onUploaded={(url, type) => {
                  if (!createdHighlight) return;
                  addItem.mutate({
                    highlight_id: createdHighlight.id,
                    media_type: type,
                    media_url: url,
                  });
                }}
              />
              <Button variant="outline" className="w-full" onClick={resetCreate}>
                Concluir
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Highlights List */}
      {highlights && highlights.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Star className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-1">Nenhum destaque criado</p>
            <p className="text-xs text-muted-foreground">Clique em "Novo Destaque" para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {highlights?.map((h) => (
            <Card key={h.id} className={`overflow-hidden transition-all ${!h.active ? "opacity-50" : ""}`}>
              <div className="aspect-square bg-muted relative flex items-center justify-center">
                {h.cover_url ? (
                  <img src={h.cover_url} alt={h.name} className="w-full h-full object-cover" />
                ) : (
                  <Star className="h-10 w-10 text-muted-foreground/30" />
                )}
                <Badge className="absolute top-2 right-2 text-[10px]">
                  {h.items?.length || 0} mídias
                </Badge>
              </div>
              <CardContent className="p-3 space-y-2">
                <p className="font-medium text-sm truncate">{h.name}</p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setEditing(h)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:text-destructive"
                    onClick={() => deleteHighlight.mutate(h.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Destaque</DialogTitle>
          </DialogHeader>
          {editing && <HighlightEditor highlight={editing} onClose={() => setEditing(null)} userId={user!.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
