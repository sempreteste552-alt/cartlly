import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";
import { SectionWrapper } from "../DynamicHomeSections";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTranslation } from "@/i18n";
import { useLocalizedTextList } from "@/hooks/useLocalizedStoreText";

interface Props {
  section: StoreHomeSection;
  primaryColor: string;
}

const DEFAULT_FAQ = {
  pt: [
    { q: "Como funciona a entrega?", a: "Enviamos para todo o Brasil com rastreamento. Prazo varia de 3 a 10 dias úteis." },
    { q: "Posso trocar ou devolver?", a: "Sim! Você tem até 7 dias após o recebimento para solicitar troca ou devolução." },
    { q: "Quais formas de pagamento?", a: "Aceitamos Pix, cartão de crédito (até 12x) e boleto bancário." },
  ],
  en: [
    { q: "How does shipping work?", a: "We ship nationwide with tracking. Delivery time usually ranges from 3 to 10 business days." },
    { q: "Can I exchange or return an item?", a: "Yes. You have up to 7 days after delivery to request an exchange or return." },
    { q: "Which payment methods are available?", a: "We accept PIX, credit card installments and bank slip." },
  ],
  es: [
    { q: "¿Cómo funciona la entrega?", a: "Enviamos a todo el país con seguimiento. El plazo suele variar entre 3 y 10 días hábiles." },
    { q: "¿Puedo cambiar o devolver?", a: "Sí. Tiene hasta 7 días después de recibirlo para solicitar cambio o devolución." },
    { q: "¿Qué métodos de pago aceptan?", a: "Aceptamos PIX, tarjeta de crédito en cuotas y boleto bancario." },
  ],
  fr: [
    { q: "Comment fonctionne la livraison ?", a: "Nous livrons avec suivi. Le délai varie généralement de 3 à 10 jours ouvrés." },
    { q: "Puis-je échanger ou retourner un article ?", a: "Oui. Vous avez jusqu'à 7 jours après réception pour demander un échange ou un retour." },
    { q: "Quels moyens de paiement acceptez-vous ?", a: "Nous acceptons PIX, carte bancaire en plusieurs fois et boleto." },
  ],
};

export function FAQSection({ section, primaryColor }: Props) {
  const { locale } = useTranslation();
  const sourceItems = (section.config as any)?.items || DEFAULT_FAQ[locale];
  const localizedValues = useLocalizedTextList(sourceItems.flatMap((item: any) => [item.q, item.a]));
  const items = sourceItems.map((item: any, index: number) => ({
    q: localizedValues[index * 2] || item.q,
    a: localizedValues[index * 2 + 1] || item.a,
  }));

  return (
    <SectionWrapper section={section} primaryColor={primaryColor}>
      <div className="max-w-2xl mx-auto">
        <Accordion type="single" collapsible className="w-full">
          {items.map((item: any, i: number) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-sm font-medium">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </SectionWrapper>
  );
}
