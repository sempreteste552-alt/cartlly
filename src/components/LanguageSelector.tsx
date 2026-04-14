import { useTranslation, LOCALE_OPTIONS, type Locale } from "@/i18n";
import { useParams } from "react-router-dom";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess, type FeatureKey } from "@/lib/planPermissions";
import { useStoreSettings, useUpdateStoreSettings } from "@/hooks/useStoreSettings";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Globe, Lock } from "lucide-react";
import { toast } from "sonner";

interface LanguageSelectorProps {
  className?: string;
  /** If true, shows only the flag icon for compact display */
  compact?: boolean;
  /** If true, skips the premium gate (for public store usage where the tenant already set language) */
  skipGate?: boolean;
}

export function LanguageSelector({ className, compact = false, skipGate = false }: LanguageSelectorProps) {
  const { slug } = useParams();
  const { locale, setLocale, t } = useTranslation();
  const { ctx } = useTenantContext();
  const { data: settings } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();

  const isPremium = skipGate || canAccess("custom_fonts" as FeatureKey, ctx); // reuse premium feature check

  const currentOption = LOCALE_OPTIONS.find(o => o.value === locale) || LOCALE_OPTIONS[0];

  const handleSelect = async (newLocale: Locale) => {
    if (!isPremium) {
      toast.error(t.settings.premiumOnly, {
        action: {
          label: t.plan.upgradePlan,
          onClick: () => window.location.assign(`/painel/${slug}/plano?upgrade=PREMIUM`),
        },
      });
      return;
    }

    setLocale(newLocale);

    // Persist to DB
    if (settings?.id) {
      try {
        await updateSettings.mutateAsync({
          id: settings.id,
          language: newLocale,
        } as any);
      } catch {
        // silent - localStorage already saved
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={compact ? "icon" : "sm"} className={className}>
          {compact ? (
            <span className="text-base">{currentOption.flag}</span>
          ) : (
            <span className="flex items-center gap-2 text-xs">
              <Globe className="h-3.5 w-3.5" />
              {currentOption.flag} {currentOption.label}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {LOCALE_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`flex items-center justify-between gap-2 ${locale === opt.value ? "bg-accent" : ""}`}
          >
            <span className="flex items-center gap-2">
              <span>{opt.flag}</span>
              <span>{opt.label}</span>
            </span>
            {!isPremium && locale !== opt.value && (
              <Lock className="h-3 w-3 text-muted-foreground" />
            )}
          </DropdownMenuItem>
        ))}
        {!isPremium && (
          <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-t mt-1">
            🔒 {t.settings.premiumOnly}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
