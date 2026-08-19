import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlanGate } from "@/components/PlanGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Sparkles, ImagePlus, Loader2 } from "lucide-react";

export default function SocialProductReview() {
  return (
    <PlanGate feature="social_product_import">
      <ReviewInner />
    </PlanGate>
  );
}

function ReviewInner() {
  const { slug, id } = useParams();
  const base = slug ? `/painel/${slug}` : "/admin";
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: sug, isLoading } = useQuery({
    queryKey: ["social_suggestion", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_product_suggestions" as any)
        .select("*, social_media_posts(provider, post_url, caption, published_at, media_url)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const [form, setForm] = useState({
    name: "", description: "", price: "", category_name: "", sku: "", brand: "", stock: "0", image_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  useEffect(() => {
    if (!sug) return;
    setForm({
      name: sug.suggested_name || "",
      description: sug.suggested_description || "",
      price: sug.suggested_price ? String(sug.suggested_price) : "",
      category_name: sug.suggested_category || "",
      sku: sug.suggested_sku || "",
      brand: sug.suggested_brand || "",
      stock: "0",
      image_url: sug.image_url || sug.social_media_posts?.media_url || "",
    });
  }, [sug]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const enhance = async () => {
    setEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-product-enhance", {
        body: {
          action: "description",
          productName: form.name,
          productDescription: form.description,
          productCategory: form.category_name,
          imageUrl: form.image_url,
          userId: user?.id,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error === "INSUFFICIENT_AI_CREDITS") {
        toast.error("⚠️ Créditos de IA insuficientes.");
      } else if (data?.result || data?.description || data?.content) {
        set("description", data.result || data.description || data.content);
        toast.success("Descrição melhorada com IA");
      } else {
        toast.error("Não conseguimos melhorar a descrição agora.");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro na IA");
    } finally {
      setEnhancing(false);
    }
  };

  const importProduct = async () => {
    if (!form.price || Number(form.price) <= 0) return toast.error("Informe o preço de venda.");
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-import-product", {
        body: {
          suggestion_id: id,
          name: form.name,
          description: form.description,
          price: Number(form.price),
          category_name: form.category_name || null,
          sku: form.sku || null,
          brand: form.brand || null,
          stock: Number(form.stock || 0),
          image_url: form.image_url,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Produto adicionado à sua loja com sucesso.");
      qc.invalidateQueries({ queryKey: ["social_suggestions"] });
      navigate(`${base}/produtos`);
    } catch (e: any) {
      toast.error(e.message || "Não conseguimos adicionar o produto.");
    } finally {
      setSaving(false);
    }
  };

  const ignore = async () => {
    await supabase.from("social_product_suggestions" as any).update({ status: "REJECTED" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["social_suggestions"] });
    toast.success("Publicação ignorada.");
    navigate(`${base}/social`);
  };

  if (isLoading) return <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!sug) return <p className="p-6 text-muted-foreground">Sugestão não encontrada.</p>;

  const post = sug.social_media_posts;

  return (
    <div className="space-y-5 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(`${base}/social`)}>
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Novo produto encontrado</h1>
        <p className="text-sm text-muted-foreground capitalize">
          {post?.provider} • {post?.published_at ? new Date(post.published_at).toLocaleString("pt-BR") : "—"}
          {sug.ai_confidence != null && (
            <Badge variant="secondary" className="ml-2">Confiança {(sug.ai_confidence * 100).toFixed(0)}%</Badge>
          )}
        </p>
      </div>

      {form.image_url && (
        <Card><CardContent className="p-3">
          <img src={form.image_url} alt={form.name} className="w-full max-h-80 object-contain rounded-lg" />
        </CardContent></Card>
      )}

      <Card><CardContent className="p-4 space-y-4">
        <div><Label>Nome</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label>Descrição</Label>
            <Button size="sm" variant="outline" onClick={enhance} disabled={enhancing}>
              <Sparkles className={`h-3.5 w-3.5 mr-1.5 ${enhancing ? "animate-pulse" : ""}`} /> Melhorar com IA
            </Button>
          </div>
          <Textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Preço de venda *</Label>
            <Input type="number" min="0" step="0.01" placeholder="0,00" value={form.price} onChange={(e) => set("price", e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">A IA nunca define preço — confirme o valor.</p>
          </div>
          <div><Label>Estoque</Label><Input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} /></div>
          <div><Label>Categoria</Label><Input value={form.category_name} onChange={(e) => set("category_name", e.target.value)} /></div>
          <div><Label>Marca</Label><Input value={form.brand} onChange={(e) => set("brand", e.target.value)} /></div>
          <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} /></div>
          <div>
            <Label>URL da imagem</Label>
            <Input value={form.image_url} onChange={(e) => set("image_url", e.target.value)} />
          </div>
        </div>
        {post?.post_url && (
          <a href={post.post_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Ver publicação original
          </a>
        )}
      </CardContent></Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={ignore}>Ignorar</Button>
        <Button onClick={importProduct} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-2" />}
          Adicionar à loja
        </Button>
      </div>
    </div>
  );
}
