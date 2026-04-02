import { useState } from "react";
import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail } from "lucide-react";

interface Props {
  section: StoreHomeSection;
  primaryColor: string;
  buttonColor: string;
  buttonTextColor: string;
}

export function NewsletterSection({ section, primaryColor, buttonColor, buttonTextColor }: Props) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    toast.success("Inscrição realizada com sucesso!");
    setEmail("");
  };

  return (
    <div className="py-12" style={{ backgroundColor: `${primaryColor}10` }}>
      <div className="max-w-xl mx-auto px-4 text-center">
        <Mail className="h-10 w-10 mx-auto mb-3" style={{ color: primaryColor }} />
        {section.title && <h2 className="text-2xl font-bold mb-2">{section.title}</h2>}
        {section.subtitle && <p className="text-muted-foreground mb-4">{section.subtitle}</p>}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="email"
            placeholder="Seu melhor e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
            required
          />
          <Button type="submit" style={{ backgroundColor: buttonColor, color: buttonTextColor }}>
            Inscrever
          </Button>
        </form>
      </div>
    </div>
  );
}
