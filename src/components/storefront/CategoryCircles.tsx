import { Tag } from "lucide-react";

export type CategoryCircleItem = {
  id: string;
  name: string;
  image_url?: string | null;
};

interface CategoryCirclesProps {
  categories: CategoryCircleItem[];
  primaryColor: string;
  onSelect: (category: CategoryCircleItem) => void;
  labels?: Record<string, string>;
}

/**
 * Instagram-highlights style category shortcuts.
 * Round cover image + name; clicking opens that category.
 */
export function CategoryCircles({ categories, primaryColor, onSelect, labels }: CategoryCirclesProps) {
  if (!categories.length) return null;

  return (
    <nav aria-label="Categorias" className="max-w-7xl mx-auto px-4 mt-6">
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => {
          const label = labels?.[cat.id] || cat.name;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat)}
              className="shrink-0 flex flex-col items-center gap-1.5 w-[76px] group focus:outline-none"
            >
              <span
                className="relative block h-[68px] w-[68px] rounded-full p-[2.5px] transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}55)` }}
              >
                <span className="block h-full w-full rounded-full overflow-hidden bg-background border-2 border-background">
                  {cat.image_url ? (
                    <img
                      src={cat.image_url}
                      alt={label}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-muted">
                      <Tag className="h-5 w-5" style={{ color: primaryColor }} />
                    </span>
                  )}
                </span>
              </span>
              <span className="text-[11px] font-medium text-foreground/80 leading-tight text-center line-clamp-2">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
