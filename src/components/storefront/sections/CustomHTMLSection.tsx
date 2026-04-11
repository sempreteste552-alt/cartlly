import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";
import { useLocalizedText } from "@/hooks/useLocalizedStoreText";

interface Props {
  section: StoreHomeSection;
}

export function CustomHTMLSection({ section }: Props) {
  const html = (section.config as any)?.html || section.description || "";
  const localizedHtml = useLocalizedText(html);

  if (!localizedHtml) return null;

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: localizedHtml }}
      />
    </div>
  );
}
