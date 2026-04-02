import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";
import { SectionWrapper } from "../DynamicHomeSections";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Props {
  section: StoreHomeSection;
  primaryColor: string;
}

const DEFAULT_FAQ = [
  { q: "Como funciona a entrega?", a: "Enviamos para todo o Brasil com rastreamento. Prazo varia de 3 a 10 dias úteis." },
  { q: "Posso trocar ou devolver?", a: "Sim! Você tem até 7 dias após o recebimento para solicitar troca ou devolução." },
  { q: "Quais formas de pagamento?", a: "Aceitamos Pix, cartão de crédito (até 12x) e boleto bancário." },
];

export function FAQSection({ section, primaryColor }: Props) {
  const items = (section.config as any)?.items || DEFAULT_FAQ;

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
