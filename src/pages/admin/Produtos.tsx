import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Package, Pencil, Trash2, Loader2, Tag, Sparkles, Layers, Lock, ArrowUpCircle, Crown, Eye } from "lucide-react";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, type Product } from "@/hooks/useProducts";
import { useCategories, useCreateCategory, useDeleteCategory } from "@/hooks/useCategories";
import { ProductForm } from "@/components/ProductForm";
import { ProductVariantsManager } from "@/components/ProductVariantsManager";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AICatalogImport } from "@/components/AICatalogImport";
import { PlanGate } from "@/components/PlanGate";
import { Progress } from "@/components/ui/progress";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess, canCreateProduct, getProductLimitReason, getPlanLimits } from "@/lib/planPermissions";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

export default function Produtos() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const { ctx } = useTenantContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [variantsProductId, setVariantsProductId] = useState<string | null>(null);

  // Auto-open product editor when navigating from dashboard low-stock alert
  useEffect(() => {
    const state = location.state as { editProductId?: string } | null;
    if (state?.editProductId && products) {
      const product = products.find((p) => p.id === state.editProductId);
      if (product) {
        setEditingProduct(product);
        setFormOpen(true);
        // Clear state to prevent re-opening on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, products, navigate, location.pathname]);

  const limits = getPlanLimits(ctx);
  const canCreate = canCreateProduct(ctx);
  const productLimitMsg = getProductLimitReason(ctx);
  const aiAvailable = canAccess("ai_content", ctx);

  const filteredProducts = products?.filter((p) => {
    // Filter by archived status
    if (showArchived) {
      if (!(p as any).is_archived) return false;
    } else {
      if ((p as any).is_archived) return false;
    }

    if (filterCategory === "all") return true;
    if (filterCategory === "none") return !p.category_id;
    return p.category_id === filterCategory;
  });

  const handleCreate = (data: any) => {
    if (data.category_id === "none") data.category_id = null;
    const { additionalImages, ...productData } = data;
    createProduct.mutate(productData, {
      onSuccess: async (created: any) => {
        if (additionalImages?.length > 0) {
          for (let i = 0; i < additionalImages.length; i++) {
            await supabase.from("product_images").insert({
              product_id: created.id,
              image_url: additionalImages[i],
              sort_order: i,
            } as any);
          }
        }
        setFormOpen(false);
      },
    });
  };

  const handleUpdate = (data: any) => {
    if (!editingProduct) return;
    if (data.category_id === "none") data.category_id = null;
    const { additionalImages, ...productData } = data;
    updateProduct.mutate({ id: editingProduct.id, ...productData }, {
      onSuccess: async () => {
        if (additionalImages?.length > 0) {
          for (let i = 0; i < additionalImages.length; i++) {
            await supabase.from("product_images").insert({
              product_id: editingProduct.id,
              image_url: additionalImages[i],
              sort_order: i + 100,
            } as any);
          }
        }
        setEditingProduct(null);
      },
    });
  };

  const handleTogglePublished = (product: Product) => {
    if ((product as any).is_archived && !product.published) {
      // If unarchiving, we might want to also set is_archived to false
      updateProduct.mutate({ id: product.id, published: true, is_archived: false } as any);
    } else {
      updateProduct.mutate({ id: product.id, published: !product.published });
    }
  };

  const handleUnarchive = (id: string) => {
    updateProduct.mutate({ id, is_archived: false, published: true } as any);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteProduct.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    createCategory.mutate(newCatName, { onSuccess: () => setNewCatName("") });
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div id="products-header" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie o catálogo da sua loja
          </p>
        </div>
        <div className="flex gap-2">
          {!aiAvailable ? (
            <Button variant="outline" disabled title="Faça upgrade para usar IA">
              <Lock className="mr-2 h-4 w-4" /> Importar com IA
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setAiImportOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Importar com IA
            </Button>
          )}
          <Button variant="outline" onClick={() => setCatDialogOpen(true)}>
            <Tag className="mr-2 h-4 w-4" />
            Categorias
          </Button>
          <Button
            id="new-product-btn"
            onClick={() => {
              if (!canCreate) {
                toast.error(productLimitMsg || "Limite atingido. Faça upgrade.");
                return;
              }
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Product usage bar */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Produtos cadastrados
            </span>
            <span className="text-sm font-bold text-foreground">
              {limits.currentProducts}/{limits.maxProducts === 99999 ? "∞" : limits.maxProducts}
            </span>
          </div>
          <Progress
            value={limits.maxProducts === 99999 ? 5 : limits.productsUsagePercent}
            className={`h-2 ${limits.productsUsagePercent >= 90 ? "[&>div]:bg-red-500" : limits.productsUsagePercent >= 70 ? "[&>div]:bg-amber-500" : ""}`}
          />
          {!canCreate && (
            <div className="flex items-center justify-between mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-amber-700 font-medium">{productLimitMsg}</p>
              </div>
              <Button size="sm" variant="outline" className="border-primary/30 text-primary gap-1 text-xs" onClick={() => navigate("/admin/plano")}>
                <Crown className="h-3 w-3" /> Upgrade
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {categories && categories.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">Filtrar:</span>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border border-border">
          <Button 
            variant={!showArchived ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setShowArchived(false)}
            className="text-xs h-8"
          >
            Ativos
          </Button>
          <Button 
            variant={showArchived ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setShowArchived(true)}
            className="text-xs h-8"
          >
            Arquivados
          </Button>
        </div>
      </div>

      {!filteredProducts?.length ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium text-foreground">Nenhum produto</h3>
            <p className="mt-1 text-sm text-muted-foreground">Comece adicionando seu primeiro produto</p>
            <Button className="mt-4" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Produto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card id="products-table" className="border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Imagem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Views</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-10 w-10 rounded-md object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    {product.categories?.name ? (
                      <Badge variant="secondary">{product.categories.name}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{formatPrice(product.price)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant={product.stock > 0 ? "secondary" : "destructive"}>
                        {product.stock}
                      </Badge>
                      {(product as any).made_to_order && (
                        <Badge variant="outline" className="text-[10px]">Encomenda</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(product as any).is_archived ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Arquivado</Badge>
                    ) : (
                      <Switch checked={product.published} onCheckedChange={() => handleTogglePublished(product)} aria-label="Publicar" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground" title="Visualizações totais">
                      <Eye className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{(product as any).views || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {(product as any).is_archived ? (
                        <Button variant="outline" size="sm" onClick={() => handleUnarchive(product.id)} className="h-8 text-xs">
                          Reativar
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => setVariantsProductId(product.id)} title="Variantes">
                            <Layers className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setEditingProduct(product)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(product.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create / Edit forms */}
      <ProductForm open={formOpen} onOpenChange={setFormOpen} onSubmit={handleCreate} loading={createProduct.isPending} />
      <ProductForm open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)} onSubmit={handleUpdate} initialData={editingProduct} loading={updateProduct.isPending} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Categories management dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nova categoria" maxLength={100} />
            <Button type="submit" size="sm" disabled={createCategory.isPending}>Adicionar</Button>
          </form>
          <div className="mt-2 space-y-1 max-h-60 overflow-auto">
            {categories?.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma categoria criada</p>
            )}
            {categories?.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm">{cat.name}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteCategory.mutate(cat.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Catalog Import */}
      <AICatalogImport open={aiImportOpen} onOpenChange={setAiImportOpen} />

      {/* Variants Manager */}
      {variantsProductId && (
        <ProductVariantsManager
          productId={variantsProductId}
          open={!!variantsProductId}
          onOpenChange={(open) => !open && setVariantsProductId(null)}
        />
      )}
    </div>
  );
}
