import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileText, Share2, Loader2, Download, MessageCircle } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { toast } from "sonner";

export function CatalogPdfGenerator() {
  const { data: products } = useProducts();
  const { data: settings } = useStoreSettings();
  const [generating, setGenerating] = useState(false);
  const [showPrices, setShowPrices] = useState(true);
  const [onlyPublished, setOnlyPublished] = useState(true);

  const storeName = (settings as any)?.store_name || "Minha Loja";
  const storeSlug = (settings as any)?.store_slug;
  const storeLogo = (settings as any)?.logo_url;

  const generateCatalog = async () => {
    if (!products?.length) return toast.error("Nenhum produto cadastrado");

    setGenerating(true);
    try {
      const filtered = onlyPublished
        ? products.filter((p) => p.published && !p.is_archived)
        : products.filter((p) => !p.is_archived);

      if (!filtered.length) {
        toast.error("Nenhum produto encontrado com os filtros selecionados");
        return;
      }

      // Build HTML catalog for print
      const html = buildCatalogHtml(filtered, storeName, showPrices, storeLogo);
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
        toast.success("Catálogo gerado! Use 'Salvar como PDF' na impressão.");
      }
    } catch (err) {
      toast.error("Erro ao gerar catálogo");
    } finally {
      setGenerating(false);
    }
  };

  const downloadCatalog = async () => {
    if (!products?.length) return toast.error("Nenhum produto cadastrado");
    setGenerating(true);
    try {
      const filtered = onlyPublished
        ? products.filter((p) => p.published && !p.is_archived)
        : products.filter((p) => !p.is_archived);
      if (!filtered.length) {
        toast.error("Nenhum produto encontrado com os filtros selecionados");
        return;
      }
      const html = buildCatalogHtml(filtered, storeName, showPrices, storeLogo);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `catalogo-${storeName.replace(/\s+/g, "-").toLowerCase()}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Catálogo baixado! Abra no navegador e salve como PDF.");
    } catch {
      toast.error("Erro ao baixar catálogo");
    } finally {
      setGenerating(false);
    }
  };

  const shareWhatsApp = () => {
    if (!storeSlug) return toast.error("Configure o slug da loja primeiro");
    const url = `${window.location.origin}/loja/${storeSlug}`;
    const text = encodeURIComponent(`Confira o catálogo da ${storeName}! 🛍️\n\n${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Catálogo PDF / WhatsApp
        </CardTitle>
        <CardDescription>Gere um catálogo visual dos seus produtos para compartilhar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={showPrices} onCheckedChange={setShowPrices} id="show-prices" />
            <Label htmlFor="show-prices">Exibir preços</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={onlyPublished} onCheckedChange={setOnlyPublished} id="only-pub" />
            <Label htmlFor="only-pub">Apenas publicados</Label>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={generateCatalog} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Gerar Catálogo PDF
          </Button>
          <Button variant="outline" onClick={() => downloadCatalog()} disabled={generating}>
            <Download className="h-4 w-4 mr-2" />
            Baixar Catálogo
          </Button>
          <Button variant="outline" onClick={shareWhatsApp}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Compartilhar no WhatsApp
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {products?.filter((p) => p.published && !p.is_archived).length || 0} produtos publicados disponíveis
        </p>
      </CardContent>
    </Card>
  );
}

function buildCatalogHtml(products: any[], storeName: string, showPrices: boolean, storeLogo?: string) {
  const items = products
    .map(
      (p) => `
    <div style="break-inside:avoid;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;">
      ${
        p.image_url
          ? `<img src="${p.image_url}" style="width:100%;height:200px;object-fit:cover;" />`
          : `<div style="width:100%;height:200px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:14px;">Sem imagem</div>`
      }
      <div style="padding:12px;">
        <h3 style="margin:0 0 4px;font-size:14px;font-weight:600;">${p.name}</h3>
        ${p.description ? `<p style="margin:0 0 8px;font-size:11px;color:#6b7280;line-height:1.4;">${p.description.slice(0, 100)}</p>` : ""}
        ${showPrices ? `<p style="margin:0;font-size:16px;font-weight:700;color:#7c3aed;">R$ ${Number(p.price).toFixed(2)}</p>` : ""}
        ${p.stock <= 0 ? `<span style="font-size:10px;color:#ef4444;">Esgotado</span>` : ""}
      </div>
    </div>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<title>Catálogo ${storeName}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0; padding:20px; background:#fff; }
  .header { text-align:center; margin-bottom:30px; }
  .header h1 { font-size:24px; margin:0; }
  .header p { color:#6b7280; margin:4px 0 0; font-size:13px; }
  .grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; }
  @media print { .grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width:600px) { .grid { grid-template-columns: repeat(2, 1fr); } }
</style>
</head><body>
<div class="header">
  ${storeLogo ? `<img src="${storeLogo}" alt="${storeName}" style="max-height:80px;max-width:240px;object-fit:contain;margin:0 auto 8px;display:block;" />` : `<h1>${storeName}</h1>`}
  <p>Catálogo de Produtos • ${new Date().toLocaleDateString("pt-BR")}</p>
</div>
<div class="grid">${items}</div>
</body></html>`;
}
