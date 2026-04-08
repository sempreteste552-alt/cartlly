import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Pencil, Image, Video, Star, X } from "lucide-react";
import {
  useStoreHighlights,
  useCreateHighlight,
  useUpdateHighlight,
  useDeleteHighlight,
  useAddHighlightItem,
  useDeleteHighlightItem,
  type StoreHighlight,
} from "@/hooks/useStoreHighlights";

function HighlightEditor({ highlight, onClose }: { highlight: StoreHighlight; onClose: () => void }) {
  const updateHighlight = useUpdateHighlight();
  const addItem = useAddHighlightItem();
  const deleteItem = useDeleteHighlightItem();
  const [name, setName] = useState(highlight.name);
  const [coverUrl, setCoverUrl] = useState(highlight.cover_url || "");
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaType, setNewMediaType] = useState<"image" | "video">("image");

  const handleSave = () => {
    updateHighlight.mutate(
      { id: highlight.id, name: name.trim(), cover_url: coverUrl.trim() || null },
      { onSuccess: onClose }
    );
  };

  const handleAddMedia = () => {
    if (!newMediaUrl.trim()) return;
    addItem.mutate({
      highlight_id: highlight.id,
      media_type: newMediaType,
      media_url: newMediaUrl.trim(),
      sort_order: (highlight.items?.length || 0) * 10,
    });
    setNewMediaUrl("");
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Nome do Destaque</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Última Edição" />
      </div>
      <div className="space-y-2">
        <Label>URL da Capa</Label>
        <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." />
        {coverUrl && (
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary mx-auto">
            <img src={coverUrl} alt="Capa" className="w-full h-full object-cover" />
          </div>
        )}
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
                    <video src={item.media_url} className="w-full h-full object-cover" muted />
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

        {/* Add new media */}
        <div className="flex gap-2">
          <div className="flex gap-1 shrink-0">
            <Button
              type="button"
              variant={newMediaType === "image" ? "default" : "outline"}
              size="sm"
              onClick={() => setNewMediaType("image")}
              className="h-9"
            >
              <Image className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={newMediaType === "video" ? "default" : "outline"}
              size="sm"
              onClick={() => setNewMediaType("video")}
              className="h-9"
            >
              <Video className="h-4 w-4" />
            </Button>
          </div>
          <Input
            value={newMediaUrl}
            onChange={(e) => setNewMediaUrl(e.target.value)}
            placeholder={`URL da ${newMediaType === "video" ? "vídeo" : "imagem"}...`}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleAddMedia()}
          />
          <Button size="sm" onClick={handleAddMedia} disabled={!newMediaUrl.trim() || addItem.isPending} className="h-9">
            {addItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
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
  const { data: highlights, isLoading } = useStoreHighlights();
  const createHighlight = useCreateHighlight();
  const deleteHighlight = useDeleteHighlight();
  const [editing, setEditing] = useState<StoreHighlight | null>(null);
  const [newName, setNewName] = useState("");
  const [newCover, setNewCover] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [createdHighlight, setCreatedHighlight] = useState<StoreHighlight | null>(null);
  const addItem = useAddHighlightItem();
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaType, setNewMediaType] = useState<"image" | "video">("image");

  const handleCreate = () => {
    if (!newName.trim()) return;
    createHighlight.mutate(
      { name: newName.trim(), cover_url: newCover.trim() || undefined },
      {
        onSuccess: (data) => {
          setCreatedHighlight(data);
          setStep(2);
        },
      }
    );
  };

  const handleAddMediaToNew = () => {
    if (!createdHighlight || !newMediaUrl.trim()) return;
    addItem.mutate({
      highlight_id: createdHighlight.id,
      media_type: newMediaType,
      media_url: newMediaUrl.trim(),
    });
    setNewMediaUrl("");
  };

  const resetCreate = () => {
    setShowCreate(false);
    setStep(1);
    setNewName("");
    setNewCover("");
    setCreatedHighlight(null);
    setNewMediaUrl("");
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
                <Label>URL da Capa (opcional)</Label>
                <Input value={newCover} onChange={(e) => setNewCover(e.target.value)} placeholder="https://..." />
                {newCover && (
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary mx-auto mt-2">
                    <img src={newCover} alt="Preview capa" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <Button onClick={handleCreate} disabled={!newName.trim() || createHighlight.isPending} className="w-full">
                {createHighlight.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar e Adicionar Mídias
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Adicione imagens ou vídeos ao destaque <strong>{createdHighlight?.name}</strong>.</p>
              <div className="flex gap-2">
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant={newMediaType === "image" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewMediaType("image")}
                  >
                    <Image className="h-4 w-4 mr-1" /> Imagem
                  </Button>
                  <Button
                    variant={newMediaType === "video" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewMediaType("video")}
                  >
                    <Video className="h-4 w-4 mr-1" /> Vídeo
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  value={newMediaUrl}
                  onChange={(e) => setNewMediaUrl(e.target.value)}
                  placeholder={`URL da ${newMediaType === "video" ? "vídeo" : "imagem"}...`}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddMediaToNew()}
                />
                <Button onClick={handleAddMediaToNew} disabled={!newMediaUrl.trim() || addItem.isPending}>
                  {addItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
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
          {editing && <HighlightEditor highlight={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
