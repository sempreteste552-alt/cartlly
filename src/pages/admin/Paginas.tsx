import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText, Plus, Pencil, Trash2, Eye, EyeOff, GripVertical, Loader2,
  BookOpen, Shield, HelpCircle, Phone, Info,
} from "lucide-react";
import { toast } from "sonner";

interface StorePage {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  content: string;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const PAGE_TEMPLATES = [
  { title: "Sobre Nós", slug: "sobre", icon: Info, description: "Conte a história da sua marca" },
  { title: "Contato", slug: "contato", icon: Phone, description: "Informações de contato" },
  { title: "Política de Troca", slug: "politica-troca", icon: Shield, description: "Regras de troca e devolução" },
  { title: "Política de Privacidade", slug: "politica-privacidade", icon: Shield, description: "Como tratamos dados pessoais" },
  { title: "FAQ", slug: "faq", icon: HelpCircle, description: "Perguntas frequentes" },
  { title: "Termos de Uso", slug: "termos", icon: BookOpen, description: "Termos e condições gerais" },
];

export default function Paginas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StorePage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(false);

  const { data: pages, isLoading } = useQuery({
    queryKey: ["store_pages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_pages")
        .select("*")
        .eq("user_id", user!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as StorePage[];
    },
  });
  
  const { data: storeSettings } = useQuery({
    queryKey: ["store_settings_admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("store_slug")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const createPage = useMutation({
    mutationFn: async (payload: Partial<StorePage>) => {
      const { error } = await supabase.from("store_pages").insert({
        user_id: user!.id,
        title: payload.title,
        slug: payload.slug,
        content: payload.content || "",
        published: payload.published ?? false,
        sort_order: (pages?.length ?? 0),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_pages"] });
      toast.success("Página criada!");
      setFormOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const updatePage = useMutation({
    mutationFn: async (payload: Partial<StorePage> & { id: string }) => {
      const { id, ...updates } = payload;
      const { error } = await supabase.from("store_pages").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_pages"] });
      toast.success("Página atualizada!");
      setFormOpen(false);
      setEditing(null);
      resetForm();
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deletePage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_pages"] });
      toast.success("Página removida!");
      setDeleteId(null);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const resetForm = () => {
    setTitle("");
    setSlug("");
    setContent("");
    setPublished(false);
  };

  const openNew = (template?: typeof PAGE_TEMPLATES[0]) => {
    setEditing(null);
    if (template) {
      setTitle(template.title);
      setSlug(template.slug);
    } else {
      resetForm();
    }
    setContent("");
    setPublished(false);
    setFormOpen(true);
  };

  const openEdit = (page: StorePage) => {
    setEditing(page);
    setTitle(page.title);
    setSlug(page.slug);
    setContent(page.content);
    setPublished(page.published);
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!title.trim()) return toast.error("Título obrigatório");
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || title.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    if (editing) {
      updatePage.mutate({ id: editing.id, title: title.trim(), slug: cleanSlug, content, published });
    } else {
      createPage.mutate({ title: title.trim(), slug: cleanSlug, content, published });
    }
  };

  const togglePublished = (page: StorePage) => {
    updatePage.mutate({ id: page.id, published: !page.published });
  };

  const existingSlugs = pages?.map(p => p.slug) ?? [];
  const availableTemplates = PAGE_TEMPLATES.filter(t => !existingSlugs.includes(t.slug));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Páginas
          </h1>
          <p className="text-muted-foreground">Crie páginas institucionais para sua loja</p>
        </div>
        <Button onClick={() => openNew()}>
          <Plus className="mr-2 h-4 w-4" /> Nova Página
        </Button>
      </div>

      {/* Quick create templates */}
      {availableTemplates.length > 0 && (
        <Card className="border-dashed border-2 border-primary/20 bg-primary/[0.02]">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">Criar a partir de template:</p>
            <div className="flex flex-wrap gap-2">
              {availableTemplates.map((t) => (
                <Button key={t.slug} variant="outline" size="sm" onClick={() => openNew(t)} className="gap-1.5">
                  <t.icon className="h-3.5 w-3.5" />
                  {t.title}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pages list */}
      {!pages?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Nenhuma página criada</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm text-center">
              Crie páginas como Sobre, FAQ e Política de Privacidade para sua loja
            </p>
            <Button className="mt-4" onClick={() => openNew()}>
              <Plus className="mr-2 h-4 w-4" /> Criar Primeira Página
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => {
            const template = PAGE_TEMPLATES.find(t => t.slug === page.slug);
            const Icon = template?.icon || FileText;
            return (
              <Card key={page.id} className="group hover:shadow-md transition-all duration-200 border-border/60">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{page.title}</h3>
                        <p className="text-xs text-muted-foreground font-mono">/{page.slug}</p>
                      </div>
                    </div>
                    <Badge variant={page.published ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {page.published ? "Publicada" : "Rascunho"}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 min-h-[2rem]">
                    {page.content ? page.content.slice(0, 100) + (page.content.length > 100 ? "..." : "") : "Sem conteúdo"}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-border/40">
                    <button
                      onClick={() => togglePublished(page)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {page.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {page.published ? "Despublicar" : "Publicar"}
                    </button>
                    <div className="flex gap-1">
                      {storeSettings?.store_slug && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" asChild title="Visualizar na Loja">
                          <Link to={`/loja/${storeSettings.store_slug}/p/${page.slug}`} target="_blank">
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(page)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(page.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Página" : "Nova Página"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Sobre Nós" maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL)</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="sobre-nos"
                  className="font-mono text-sm"
                  maxLength={60}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escreva o conteúdo da página..."
                className="min-h-[200px] resize-y"
                maxLength={10000}
              />
              <p className="text-[11px] text-muted-foreground">{content.length}/10.000 caracteres</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label>Publicar página</Label>
                <p className="text-xs text-muted-foreground">Torne visível na loja</p>
              </div>
              <Switch checked={published} onCheckedChange={setPublished} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setFormOpen(false); setEditing(null); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={createPage.isPending || updatePage.isPending}>
                {(createPage.isPending || updatePage.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Criar Página"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover página?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deletePage.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
