import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";
import { Button } from "@/components/ui/button";

interface Props {
  section: StoreHomeSection;
  primaryColor: string;
  buttonColor: string;
  buttonTextColor: string;
}

export function HeroBannerSection({ section, primaryColor, buttonColor, buttonTextColor }: Props) {
  const hasImage = !!section.image_url;
  const hasVideo = !!section.video_url;

  return (
    <div className="relative w-full overflow-hidden rounded-xl max-w-7xl mx-auto px-4">
      <div
        className="relative w-full min-h-[280px] md:min-h-[420px] rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          background: hasImage || hasVideo ? undefined : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}aa)`,
        }}
      >
        {hasVideo ? (
          <video
            src={section.video_url!}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : hasImage ? (
          <img
            src={section.image_url!}
            alt={section.title || "Banner"}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : null}

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Content */}
        <div className="relative z-10 text-center px-6 py-12 text-white max-w-2xl">
          {section.title && <h1 className="text-3xl md:text-5xl font-bold mb-3 drop-shadow-lg">{section.title}</h1>}
          {section.subtitle && <p className="text-lg md:text-xl mb-2 drop-shadow">{section.subtitle}</p>}
          {section.description && <p className="text-sm md:text-base mb-6 opacity-90">{section.description}</p>}
          {section.button_text && section.button_link && (
            <a href={section.button_link}>
              <Button
                size="lg"
                className="text-base px-8"
                style={{ backgroundColor: buttonColor, color: buttonTextColor }}
              >
                {section.button_text}
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
