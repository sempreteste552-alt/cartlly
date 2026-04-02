import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";
import { SectionWrapper } from "../DynamicHomeSections";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

interface Props {
  section: StoreHomeSection;
  primaryColor: string;
}

const DEFAULT_TESTIMONIALS = [
  { name: "Maria S.", text: "Produto de excelente qualidade! Entrega rápida e bem embalado.", rating: 5 },
  { name: "João P.", text: "Superou minhas expectativas. Com certeza comprarei novamente!", rating: 5 },
  { name: "Ana C.", text: "Atendimento incrível e preço justo. Recomendo a todos!", rating: 4 },
];

export function TestimonialsSection({ section, primaryColor }: Props) {
  const testimonials = (section.config as any)?.testimonials || DEFAULT_TESTIMONIALS;

  return (
    <SectionWrapper section={section} primaryColor={primaryColor}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {testimonials.map((t: any, i: number) => (
          <Card key={i} className="border-border">
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
