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
import { useTranslation } from "@/i18n";
import { useLocalizedText } from "@/hooks/useLocalizedStoreText";

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
  onAddToCart?: (name: string, image?: string | null) => void;
}

export function DynamicHomeSections({ storeUserId, products, settings, cart, basePath, onAddToCart }: Props) {
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
            onAddToCart={onAddToCart}
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
  onAddToCart,
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
  onAddToCart?: (name: string, image?: string | null) => void;
}) {
  const { locale } = useTranslation();
  const uiText = {
    pt: { instagramSoon: "Feed do Instagram em breve" },
    en: { instagramSoon: "Instagram feed coming soon" },
    es: { instagramSoon: "Feed de Instagram próximamente" },
    fr: { instagramSoon: "Flux Instagram bientôt disponible" },
  }[locale];

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
          onAddToCart={onAddToCart}
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
          onAddToCart={onAddToCart}
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

    case "highlights":
      return <HighlightsSection storeUserId={storeUserId} primaryColor={primaryColor} />;
    case "instagram_feed":
      return (
        <SectionWrapper section={section} primaryColor={primaryColor}>
          <p className="text-sm text-muted-foreground text-center">{uiText.instagramSoon}</p>
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
  const localizedTitle = useLocalizedText(section.title);
  const localizedSubtitle = useLocalizedText(section.subtitle);

  return (
    <div className={`max-w-7xl mx-auto px-4 ${className}`}>
      {(localizedTitle || localizedSubtitle) && (
        <div className="text-center mb-6">
          {localizedTitle && (
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: primaryColor, fontFamily: "var(--store-font-heading)" }}>
              {localizedTitle}
            </h2>
          )}
          {localizedSubtitle && <p className="text-muted-foreground mt-1">{localizedSubtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
