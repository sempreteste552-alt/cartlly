import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, GripVertical, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Smartphone, Monitor, Pencil, Upload } from "lucide-react";
import {
  useStoreHomeSections,
  useCreateHomeSection,
  useUpdateHomeSection,
  useDeleteHomeSection,
  useReorderHomeSections,
  SECTION_TYPES,
  type StoreHomeSection,
} from "@/hooks/useStoreHomeSections";
import { useUploadProductImage } from "@/hooks/useProducts";
import { useRef } from "react";
import { toast } from "sonner";

function SectionEditor({ section, onClose }: { section: StoreHomeSection; onClose: () => void }) {
  const updateSection = useUpdateHomeSection();
  const uploadFile = useUploadProductImage();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(section.title || "");
...
  const [buttonLink, setButtonLink] = useState(section.button_link || "");
  const [desktopVisible, setDesktopVisible] = useState(section.desktop_visible);
  const [mobileVisible, setMobileVisible] = useState(section.mobile_visible);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile.mutateAsync(file);
      if (type === "image") setImageUrl(url);
      else setVideoUrl(url);
      toast.success("Arquivo enviado com sucesso!");
    } catch (err) {
      // toast shown by hook
    }
  };

  const handleSave = () => {
    updateSection.mutate({
      id: section.id,
      title: title.trim() || null,
      subtitle: subtitle.trim() || null,
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      video_url: videoUrl.trim() || null,
      button_text: buttonText.trim() || null,
      button_link: buttonLink.trim() || null,
      desktop_visible: desktopVisible,
      mobile_visible: mobileVisible,
    }, { onSuccess: onClose });
  };

  const sectionMeta = SECTION_TYPES.find((s) => s.value === section.section_type);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{sectionMeta?.icon}</span>
        <h3 className="font-semibold">{sectionMeta?.label}</h3>
      </div>

      <div className="space-y-2">
        <Label>Título</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da seção" />
      </div>
      <div className="space-y-2">
        <Label>Subtítulo</Label>
        <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtítulo opcional" />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da seção" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>URL da Imagem</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="space-y-2">
          <Label>URL do Vídeo</Label>
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Texto do Botão</Label>
          <Input value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="Ver Mais" />
        </div>
        <div className="space-y-2">
          <Label>Link do Botão</Label>
          <Input value={buttonLink} onChange={(e) => setButtonLink(e.target.value)} placeholder="/colecao/verao" />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm">Desktop</Label>
          <Switch checked={desktopVisible} onCheckedChange={setDesktopVisible} />
        </div>
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm">Mobile</Label>
          <Switch checked={mobileVisible} onCheckedChange={setMobileVisible} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={updateSection.isPending}>
          {updateSection.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}

export default function HomeBuilderManager() {
  const { data: sections, isLoading } = useStoreHomeSections();
  const createSection = useCreateHomeSection();
  const updateSection = useUpdateHomeSection();
  const deleteSection = useDeleteHomeSection();
  const reorderSections = useReorderHomeSections();
  const [editingSection, setEditingSection] = useState<StoreHomeSection | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const handleAddSection = (sectionType: string) => {
    const meta = SECTION_TYPES.find((s) => s.value === sectionType);
    createSection.mutate({
      section_type: sectionType,
      title: meta?.label || sectionType,
      sort_order: (sections?.length || 0) * 10,
    });
    setAddDialogOpen(false);
  };

  const handleToggleEnabled = (section: StoreHomeSection) => {
    updateSection.mutate({ id: section.id, enabled: !section.enabled });
  };

  const handleMoveUp = (index: number) => {
    if (!sections || index <= 0) return;
    const reordered = [...sections];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    reorderSections.mutate(reordered.map((s, i) => ({ id: s.id, sort_order: i * 10 })));
  };

  const handleMoveDown = (index: number) => {
    if (!sections || index >= sections.length - 1) return;
    const reordered = [...sections];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    reorderSections.mutate(reordered.map((s, i) => ({ id: s.id, sort_order: i * 10 })));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Seções da Página Inicial</h2>
          <p className="text-sm text-muted-foreground">Adicione, ordene e configure as seções da home da sua loja</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Adicionar Seção</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Adicionar Seção</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
              {SECTION_TYPES.map((type) => (
                <Button
                  key={type.value}
                  variant="outline"
                  className="h-auto py-3 justify-start gap-2"
                  onClick={() => handleAddSection(type.value)}
                >
                  <span className="text-xl">{type.icon}</span>
                  <span className="text-sm">{type.label}</span>
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sections List */}
      {sections && sections.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-2">Nenhuma seção adicionada</p>
            <p className="text-xs text-muted-foreground">Clique em "Adicionar Seção" para começar a construir sua home</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {sections?.map((section, index) => {
          const meta = SECTION_TYPES.find((s) => s.value === section.section_type);
          return (
            <Card key={section.id} className={`border-border transition-opacity ${!section.enabled ? "opacity-50" : ""}`}>
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab shrink-0" />

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg">{meta?.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{section.title || meta?.label}</p>
                    <p className="text-xs text-muted-foreground">{meta?.label}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!section.desktop_visible && (
                    <Badge variant="outline" className="text-[10px] px-1"><Monitor className="h-3 w-3" /></Badge>
                  )}
                  {!section.mobile_visible && (
                    <Badge variant="outline" className="text-[10px] px-1"><Smartphone className="h-3 w-3" /></Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMoveUp(index)} disabled={index === 0}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMoveDown(index)} disabled={index === (sections?.length || 0) - 1}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleEnabled(section)}>
                    {section.enabled ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingSection(section)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteSection.mutate(section.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingSection} onOpenChange={(open) => !open && setEditingSection(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Seção</DialogTitle>
          </DialogHeader>
          {editingSection && <SectionEditor section={editingSection} onClose={() => setEditingSection(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
