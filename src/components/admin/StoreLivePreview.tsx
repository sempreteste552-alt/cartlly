import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Monitor, Smartphone, RefreshCw, ExternalLink, X } from "lucide-react";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { buildStoreUrl } from "@/lib/storeDomain";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

interface StoreLivePreviewProps {
  className?: string;
  forceMobile?: boolean;
}

export function StoreLivePreview({ className, forceMobile }: StoreLivePreviewProps) {
  const { data: settings } = useStoreSettings();
  const [isOpen, setIsOpen] = useState(false);
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
    pt: { title: "Prévia da Loja", open: "Ver Loja", close: "Fechar Prévia", desktop: "Desktop", mobile: "Celular", reload: "Recarregar", external: "Abrir em nova aba" },
    en: { title: "Store Preview", open: "Preview Store", close: "Close Preview", desktop: "Desktop", mobile: "Mobile", reload: "Reload", external: "Open in new tab" },
    es: { title: "Vista previa", open: "Ver tienda", close: "Cerrar previa", desktop: "Escritorio", mobile: "Móvil", reload: "Recargar", external: "Abrir en nueva pestaña" },
    fr: { title: "Aperçu", open: "Voir la boutique", close: "Fermer l'aperçu", desktop: "Ordinateur", mobile: "Mobile", reload: "Recharger", external: "Ouvrir dans un nouvel onglet" },
  }[locale] || { title: "Prévia da Loja", open: "Ver Loja", close: "Fechar Prévia", desktop: "Desktop", mobile: "Celular", reload: "Recarregar", external: "Abrir em nova aba" };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn("fixed bottom-20 right-6 shadow-2xl gap-2 z-50 rounded-full py-6 px-6", className)}
        size="lg"
      >
        <Eye className="h-5 w-5" />
        {text.open}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background/95 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4 bg-card p-2 rounded-lg border shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="font-bold flex items-center gap-2 px-2">
            <Eye className="h-4 w-4 text-primary" />
            {text.title}
          </h2>
          <div className="flex bg-muted rounded-md p-1">
            <Button
              variant={viewMode === "desktop" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("desktop")}
              className="h-8 gap-1"
            >
              <Monitor className="h-4 w-4" />
              <span className="hidden sm:inline">{text.desktop}</span>
            </Button>
            <Button
              variant={viewMode === "mobile" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("mobile")}
              className="h-8 gap-1"
            >
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">{text.mobile}</span>
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setKey(k => k + 1)} title={text.reload}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => window.open(storeUrl, "_blank")} title={text.external}>
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex justify-center items-start overflow-hidden bg-muted/30 rounded-xl border border-dashed border-border/60">
        <div 
          className={cn(
            "bg-white shadow-2xl transition-all duration-500 overflow-hidden relative",
            viewMode === "mobile" ? "w-[375px] h-[667px] sm:h-[812px] rounded-[3rem] border-[8px] border-black mt-4" : "w-full h-full rounded-lg"
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
      
      <p className="text-center text-xs text-muted-foreground mt-4">
        {locale === "pt" ? "Dica: salve as alterações para vê-las refletidas aqui." : "Tip: save changes to see them reflected here."}
      </p>
    </div>
  );
}
