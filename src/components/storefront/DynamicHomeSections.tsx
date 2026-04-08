import { usePublicHomeSections } from "@/hooks/usePublicStoreConfig";
import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";
import { HeroBannerSection } from "./sections/HeroBannerSection";
import { FeaturedProductsSection } from "./sections/FeaturedProductsSection";
import { TestimonialsSection } from "./sections/TestimonialsSection";
import { VideoSection } from "./sections/VideoSection";
import { NewsletterSection } from "./sections/NewsletterSection";
import { CountdownSection } from "./sections/CountdownSection";
import { FAQSection } from "./sections/FAQSection";
import { CustomHTMLSection } from "./sections/CustomHTMLSection";
import { GenericProductSection } from "./sections/GenericProductSection";
import { HighlightsSection } from "./sections/HighlightsSection";
import { useEffect, useState } from "react";

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

interface Props {
  storeUserId?: string;
  products?: any[];
  settings?: any;
  cart?: any;
  basePath?: string;
}

export function DynamicHomeSections({ storeUserId, products, settings, cart, basePath }: Props) {
  const { data: sections } = usePublicHomeSections(storeUserId);
  const isMobile = useIsMobile();

  if (!sections || sections.length === 0) return null;

  const primaryColor = settings?.primary_color || "#6d28d9";
  const buttonColor = settings?.button_color || "#000000";
  const buttonTextColor = settings?.button_text_color || "#ffffff";

  return (
    <div className="space-y-8">
      {sections
        .filter((s) => (isMobile ? s.mobile_visible : s.desktop_visible))
        .map((section) => (
          <DynamicSection
            key={section.id}
            section={section}
            storeUserId={storeUserId}
            products={products}
            settings={settings}
            cart={cart}
            basePath={basePath}
            primaryColor={primaryColor}
            buttonColor={buttonColor}
            buttonTextColor={buttonTextColor}
          />
        ))}
    </div>
  );
}

function DynamicSection({
  section,
  storeUserId,
  products,
  settings,
  cart,
  basePath,
  primaryColor,
  buttonColor,
  buttonTextColor,
}: {
  section: StoreHomeSection;
  storeUserId?: string;
  products?: any[];
  settings?: any;
  cart?: any;
  basePath?: string;
  primaryColor: string;
  buttonColor: string;
  buttonTextColor: string;
}) {
  switch (section.section_type) {
    case "hero_banner":
      return <HeroBannerSection section={section} primaryColor={primaryColor} buttonColor={buttonColor} buttonTextColor={buttonTextColor} />;

    case "slider":
      return <HeroBannerSection section={section} primaryColor={primaryColor} buttonColor={buttonColor} buttonTextColor={buttonTextColor} />;

    case "featured_products":
    case "best_sellers":
    case "new_arrivals":
    case "collections":
      return (
        <GenericProductSection
          section={section}
          products={products}
          cart={cart}
          basePath={basePath}
          primaryColor={primaryColor}
          buttonColor={buttonColor}
          buttonTextColor={buttonTextColor}
        />
      );

    case "categories":
      return (
        <GenericProductSection
          section={section}
          products={products}
          cart={cart}
          basePath={basePath}
          primaryColor={primaryColor}
          buttonColor={buttonColor}
          buttonTextColor={buttonTextColor}
        />
      );

    case "testimonials":
      return <TestimonialsSection section={section} primaryColor={primaryColor} />;

    case "video":
    case "video_text":
      return <VideoSection section={section} primaryColor={primaryColor} />;

    case "countdown":
      return <CountdownSection section={section} primaryColor={primaryColor} />;

    case "faq":
      return <FAQSection section={section} primaryColor={primaryColor} />;

    case "newsletter":
      return <NewsletterSection section={section} primaryColor={primaryColor} buttonColor={buttonColor} buttonTextColor={buttonTextColor} />;

    case "custom_html":
      return <CustomHTMLSection section={section} />;

    case "instagram_feed":
      return (
        <SectionWrapper section={section} primaryColor={primaryColor}>
          <p className="text-sm text-muted-foreground text-center">Feed do Instagram em breve</p>
        </SectionWrapper>
      );

    default:
      return null;
  }
}

export function SectionWrapper({
  section,
  primaryColor,
  children,
  className = "",
}: {
  section: StoreHomeSection;
  primaryColor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-w-7xl mx-auto px-4 ${className}`}>
      {(section.title || section.subtitle) && (
        <div className="text-center mb-6">
          {section.title && (
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: primaryColor }}>
              {section.title}
            </h2>
          )}
          {section.subtitle && <p className="text-muted-foreground mt-1">{section.subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
