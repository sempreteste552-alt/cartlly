import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";
import { SectionWrapper } from "../DynamicHomeSections";
import { useTranslation } from "@/i18n";
import { useLocalizedText } from "@/hooks/useLocalizedStoreText";

interface Props {
  section: StoreHomeSection;
  primaryColor: string;
}

export function VideoSection({ section, primaryColor }: Props) {
  const isVideoText = section.section_type === "video_text";
  const { locale } = useTranslation();
  const localizedTitle = useLocalizedText(section.title);
  const localizedDescription = useLocalizedText(section.description);
  const localizedButtonText = useLocalizedText(section.button_text);
  const uiText = {
    pt: { noVideo: "Nenhum vídeo configurado", fallbackTitle: "Vídeo" },
    en: { noVideo: "No video configured", fallbackTitle: "Video" },
    es: { noVideo: "No hay video configurado", fallbackTitle: "Video" },
    fr: { noVideo: "Aucune vidéo configurée", fallbackTitle: "Vidéo" },
  }[locale];

  if (!section.video_url) {
    return (
      <SectionWrapper section={section} primaryColor={primaryColor}>
        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground">{uiText.noVideo}</p>
        </div>
      </SectionWrapper>
    );
  }

  const isYoutube = section.video_url.includes("youtube.com") || section.video_url.includes("youtu.be");
  const embedUrl = isYoutube
    ? section.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")
    : null;

  return (
    <SectionWrapper section={section} primaryColor={primaryColor}>
      <div className={isVideoText ? "grid grid-cols-1 md:grid-cols-2 gap-6 items-center" : ""}>
        <div className="aspect-video rounded-lg overflow-hidden bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={localizedTitle || uiText.fallbackTitle}
            />
          ) : (
            <video
              src={section.video_url}
              controls
              className="w-full h-full object-cover"
              playsInline
            />
          )}
        </div>

        {isVideoText && (
          <div className="space-y-4">
            {localizedDescription && (
              <p className="text-muted-foreground whitespace-pre-wrap">{localizedDescription}</p>
            )}
            {localizedButtonText && section.button_link && (
              <a
                href={section.button_link}
                className="inline-block px-6 py-2.5 rounded-lg font-medium text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {localizedButtonText}
              </a>
            )}
          </div>
        )}
      </div>
    </SectionWrapper>
  );
}
