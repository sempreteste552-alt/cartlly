import { useI18n, localeLabels, type Locale } from "@/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
}

export function LanguageSwitcher({ compact, className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n();

  return (
    <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
      <SelectTrigger className={`${compact ? "w-[70px] h-8 text-xs" : "w-[140px]"} ${className || ""}`}>
        <Globe className="h-3.5 w-3.5 mr-1 shrink-0" />
        <SelectValue>{compact ? locale.toUpperCase() : localeLabels[locale]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(localeLabels) as Locale[]).map((l) => (
          <SelectItem key={l} value={l}>{localeLabels[l]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
