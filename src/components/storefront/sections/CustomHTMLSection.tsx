import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";

interface Props {
  section: StoreHomeSection;
}

export function CustomHTMLSection({ section }: Props) {
  const html = (section.config as any)?.html || section.description || "";

  if (!html) return null;

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
