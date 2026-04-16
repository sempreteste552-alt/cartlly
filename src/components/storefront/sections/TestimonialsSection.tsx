import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";
import { SectionWrapper } from "../DynamicHomeSections";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useLocalizedTextList } from "@/hooks/useLocalizedStoreText";

interface Props {
  section: StoreHomeSection;
  primaryColor: string;
}

const DEFAULT_TESTIMONIALS = {
  pt: [
    { name: "Maria S.", text: "Produto de excelente qualidade! Entrega rápida e bem embalado.", rating: 5 },
    { name: "João P.", text: "Superou minhas expectativas. Com certeza comprarei novamente!", rating: 5 },
    { name: "Ana C.", text: "Atendimento incrível e preço justo. Recomendo a todos!", rating: 4 },
  ],
  en: [
    { name: "Maria S.", text: "Excellent product quality. Fast delivery and great packaging.", rating: 5 },
    { name: "John P.", text: "It exceeded my expectations. I will definitely buy again.", rating: 5 },
    { name: "Anna C.", text: "Amazing service and fair pricing. Highly recommended.", rating: 4 },
  ],
  es: [
    { name: "María S.", text: "Producto de excelente calidad. Entrega rápida y bien embalada.", rating: 5 },
    { name: "Juan P.", text: "Superó mis expectativas. Sin duda volveré a comprar.", rating: 5 },
    { name: "Ana C.", text: "Atención increíble y precio justo. Lo recomiendo a todos.", rating: 4 },
  ],
  fr: [
    { name: "Marie S.", text: "Produit d'excellente qualité. Livraison rapide et bien emballée.", rating: 5 },
    { name: "Jean P.", text: "Cela a dépassé mes attentes. J'achèterai à nouveau sans hésiter.", rating: 5 },
    { name: "Anne C.", text: "Service incroyable et prix juste. Je recommande vivement.", rating: 4 },
  ],
};

export function TestimonialsSection({ section, primaryColor }: Props) {
  const { locale } = useTranslation();
  const sourceTestimonials = (section.config as any)?.testimonials || DEFAULT_TESTIMONIALS[locale];
  const localizedTexts = useLocalizedTextList(sourceTestimonials.map((item: any) => item.text));
  const testimonials = sourceTestimonials.map((item: any, index: number) => ({
    ...item,
    text: localizedTexts[index] || item.text,
  }));

  return (
    <SectionWrapper section={section} primaryColor={primaryColor}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {testimonials.map((t: any, i: number) => (
          <Card key={i} className="border border-white/20 bg-white/10 dark:bg-black/20 backdrop-blur-md shadow-xl">
            <CardContent className="p-6 text-center space-y-3">
              <div className="flex justify-center gap-0.5">
                {[...Array(5)].map((_, j) => (
                  <Star
                    key={j}
                    className={`h-4 w-4 ${j < t.rating ? "fill-yellow-400 text-yellow-400" : "text-muted"}`}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground italic">"{t.text}"</p>
              <p className="text-sm font-semibold">{t.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </SectionWrapper>
  );
}
