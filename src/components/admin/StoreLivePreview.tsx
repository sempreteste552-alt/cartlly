import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Monitor, Smartphone, RefreshCw, ExternalLink, X } from "lucide-react";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { buildStoreUrl } from "@/lib/storeDomain";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface StoreLivePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forceMobile?: boolean;
}

export function StoreLivePreview({ open, onOpenChange, forceMobile }: StoreLivePreviewProps) {
  const { data: settings } = useStoreSettings();
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">(forceMobile ? "mobile" : "desktop");
  const [key, setKey] = useState(0); // For reloading iframe
  const { locale } = useTranslation();

  const storeUrl = settings ? buildStoreUrl({
    slug: settings.store_slug,
    customDomain: settings.custom_domain,
    domainStatus: settings.domain_status,
  }) : "";

  // Add a preview parameter to avoid some tracking if needed
  const previewUrl = storeUrl ? `${storeUrl}?preview=true` : "";

  const text = {
    pt: { title: "Prévia da Loja", desktop: "Desktop", mobile: "Celular", reload: "Recarregar", external: "Abrir em nova aba", tip: "Dica: salve as alterações para vê-las refletidas aqui." },
    en: { title: "Store Preview", desktop: "Desktop", mobile: "Mobile", reload: "Reload", external: "Open in new tab", tip: "Tip: save changes to see them reflected here." },
    es: { title: "Vista previa", desktop: "Escritorio", mobile: "Móvil", reload: "Recargar", external: "Abrir en nueva pestaña", tip: "Dica: guarda los cambios para verlos reflejados aquí." },
    fr: { title: "Aperçu", desktop: "Ordinateur", mobile: "Mobile", reload: "Recharger", external: "Ouvrir dans un nouvel onglet", tip: "Conseil : enregistrez les modifications para les voir ici." },
  }[locale] || { title: "Prévia da Loja", desktop: "Desktop", mobile: "Celular", reload: "Recarregar", external: "Abrir em nova aba", tip: "Dica: salve as alterações para vê-las refletidas aqui." };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-4 gap-4">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-4">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {text.title}
            </DialogTitle>
            <div className="flex bg-muted rounded-md p-1">
              <Button
                variant={viewMode === "desktop" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("desktop")}
                className="h-8 gap-1 px-3"
              >
                <Monitor className="h-4 w-4" />
                <span className="hidden sm:inline">{text.desktop}</span>
              </Button>
              <Button
                variant={viewMode === "mobile" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("mobile")}
                className="h-8 gap-1 px-3"
              >
                <Smartphone className="h-4 w-4" />
                <span className="hidden sm:inline">{text.mobile}</span>
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pr-8">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setKey(k => k + 1)} title={text.reload}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.open(storeUrl, "_blank")} title={text.external}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex justify-center items-start overflow-hidden bg-muted/30 rounded-xl border border-dashed border-border/60 p-2">
          <div 
            className={cn(
              "bg-white shadow-2xl transition-all duration-500 overflow-hidden relative",
              viewMode === "mobile" ? "w-[375px] h-full max-h-[812px] rounded-[3rem] border-[8px] border-black" : "w-full h-full rounded-lg"
            )}
          >
            {viewMode === "mobile" && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-20" />
            )}
            <iframe
              key={key}
              src={previewUrl}
              className="w-full h-full border-none"
              title={text.title}
            />
          </div>
        </div>
        
        <p className="text-center text-[10px] text-muted-foreground">
          {text.tip}
        </p>
      </DialogContent>
    </Dialog>
  );
}
