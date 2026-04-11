import { useState } from "react";
import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useLocalizedText } from "@/hooks/useLocalizedStoreText";

interface Props {
  section: StoreHomeSection;
  primaryColor: string;
  buttonColor: string;
  buttonTextColor: string;
}

export function NewsletterSection({ section, primaryColor, buttonColor, buttonTextColor }: Props) {
  const [email, setEmail] = useState("");
  const { locale } = useTranslation();
  const localizedTitle = useLocalizedText(section.title);
  const localizedSubtitle = useLocalizedText(section.subtitle);
  const uiText = {
    pt: { success: "Inscrição realizada com sucesso!", placeholder: "Seu melhor e-mail", submit: "Inscrever" },
    en: { success: "Subscription completed successfully!", placeholder: "Your best email", submit: "Subscribe" },
    es: { success: "¡Suscripción realizada con éxito!", placeholder: "Tu mejor correo", submit: "Suscribirse" },
    fr: { success: "Inscription réalisée avec succès !", placeholder: "Votre meilleur e-mail", submit: "S'inscrire" },
  }[locale];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    toast.success(uiText.success);
    setEmail("");
  };

  return (
    <div className="py-12" style={{ backgroundColor: `${primaryColor}10` }}>
      <div className="max-w-xl mx-auto px-4 text-center">
        <Mail className="h-10 w-10 mx-auto mb-3" style={{ color: primaryColor }} />
        {localizedTitle && <h2 className="text-2xl font-bold mb-2">{localizedTitle}</h2>}
        {localizedSubtitle && <p className="text-muted-foreground mb-4">{localizedSubtitle}</p>}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="email"
            placeholder={uiText.placeholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
            required
          />
          <Button type="submit" style={{ backgroundColor: buttonColor, color: buttonTextColor }}>
            {uiText.submit}
          </Button>
        </form>
      </div>
    </div>
  );
}
