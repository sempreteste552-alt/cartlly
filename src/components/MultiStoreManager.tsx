import { useState } from "react";
import { useTenantStores } from "@/hooks/useTenantStores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Store, Plus, ExternalLink, Trash2, Loader2 } from "lucide-react";

export function MultiStoreManager() {
  const { stores, isLoading, canCreateMore, createStore, deleteStore } = useTenantStores();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const handleCreate = async () => {
    if (!newName.trim() || !newSlug.trim()) return;
    await createStore.mutateAsync({ store_name: newName, store_slug: newSlug });
    setDialogOpen(false);
    setNewName("");
    setNewSlug("");
  };

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          Minhas Lojas ({stores.length}/2)
        </CardTitle>
        {canCreateMore && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> Nova Loja
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Loja</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Loja</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Moda Fashion" />
                </div>
                <div className="space-y-2">
                  <Label>Slug da Loja</Label>
                  <div className="flex items-center gap-0">
                    <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 border-border bg-muted px-3 text-xs text-muted-foreground">/loja/</span>
                    <Input
                      value={newSlug}
                      onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="moda-fashion"
                      className="rounded-l-none"
                    />
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={createStore.isPending || !newName.trim() || !newSlug.trim()} className="w-full">
                  {createStore.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Criar Loja
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : stores.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma loja extra criada. Sua loja principal está nas Configurações.</p>
        ) : (
          <div className="space-y-3">
            {stores.map((store: any) => (
              <div key={store.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Store className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{store.store_name}</p>
                    <p className="text-xs text-muted-foreground">/loja/{store.store_slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={store.is_active ? "default" : "secondary"}>
                    {store.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(`/loja/${store.store_slug}`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteStore.mutate(store.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
