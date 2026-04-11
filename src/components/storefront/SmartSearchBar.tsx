import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, Clock, TrendingUp, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getLocaleTag, useTranslation } from "@/i18n";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category_id: string | null;
  categories?: { name: string } | null;
}

interface SmartSearchBarProps {
  products: Product[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onProductClick?: (productId: string) => void;
  primaryColor?: string;
  storeUserId?: string;
  className?: string;
}

const HISTORY_KEY = "search_history";
const MAX_HISTORY = 8;

function getSearchHistory(storeId?: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(`${HISTORY_KEY}_${storeId || "g"}`) || "[]");
  } catch { return []; }
}

function saveSearchHistory(term: string, storeId?: string) {
  const key = `${HISTORY_KEY}_${storeId || "g"}`;
  const history = getSearchHistory(storeId).filter((h) => h !== term);
  history.unshift(term);
  localStorage.setItem(key, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

/** Simple fuzzy match: allows typos by checking if most chars exist in order */
function fuzzyMatch(text: string, query: string): { match: boolean; score: number } {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  
  // Exact substring match = best score
  if (t.includes(q)) return { match: true, score: 3 };
  
  // Levenshtein-like: allow 1-2 char differences for short queries
  if (q.length >= 3) {
    // Check if removing one char from query matches
    for (let i = 0; i < q.length; i++) {
      const reduced = q.slice(0, i) + q.slice(i + 1);
      if (t.includes(reduced)) return { match: true, score: 2 };
    }
    // Check swapped adjacent chars
    for (let i = 0; i < q.length - 1; i++) {
      const swapped = q.slice(0, i) + q[i + 1] + q[i] + q.slice(i + 2);
      if (t.includes(swapped)) return { match: true, score: 1 };
    }
  }
  
  return { match: false, score: 0 };
}

export function SmartSearchBar({
  products,
  searchTerm,
  onSearchChange,
  onProductClick,
  primaryColor = "#6d28d9",
  storeUserId,
  className,
}: SmartSearchBarProps) {
  const { t, locale } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const history = useMemo(() => getSearchHistory(storeUserId), [storeUserId, showDropdown]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const suggestions = useMemo(() => {
    if (!searchTerm.trim() || !products) return [];
    const results: { product: Product; score: number }[] = [];
    
    for (const p of products) {
      const nameMatch = fuzzyMatch(p.name, searchTerm);
      const catMatch = fuzzyMatch((p as any).categories?.name || "", searchTerm);
      const bestScore = Math.max(nameMatch.score, catMatch.score);
      if (nameMatch.match || catMatch.match) {
        results.push({ product: p, score: bestScore });
      }
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((r) => r.product);
  }, [searchTerm, products]);

  const handleSelect = useCallback((term: string) => {
    onSearchChange(term);
    saveSearchHistory(term, storeUserId);
    setShowDropdown(false);
    inputRef.current?.blur();
  }, [onSearchChange, storeUserId]);

  const handleProductSelect = useCallback((product: Product) => {
    saveSearchHistory(product.name, storeUserId);
    setShowDropdown(false);
    onProductClick?.(product.id);
  }, [onProductClick, storeUserId]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(getLocaleTag(locale), { style: "currency", currency: "BRL" }).format(price);

  const showSuggestions = showDropdown && (searchTerm.trim() ? suggestions.length > 0 : history.length > 0);

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={t.store.searchPlaceholder}
          value={searchTerm}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => { setIsFocused(true); setShowDropdown(true); }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && searchTerm.trim()) {
              saveSearchHistory(searchTerm.trim(), storeUserId);
              setShowDropdown(false);
            }
            if (e.key === "Escape") setShowDropdown(false);
          }}
          className="pl-9 pr-8 h-10 bg-background"
        />
        {searchTerm && (
          <button
            onClick={() => { onSearchChange(""); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showSuggestions && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200"
        >
          {!searchTerm.trim() && history.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {locale === "pt" ? "Buscas recentes" : locale === "en" ? "Recent searches" : locale === "es" ? "Búsquedas recientes" : "Recherches récentes"}
              </p>
              {history.map((h, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(h)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md flex items-center gap-2 text-foreground"
                >
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{h}</span>
                </button>
              ))}
            </div>
          )}

          {searchTerm.trim() && suggestions.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> {locale === "pt" ? "Sugestões" : locale === "en" ? "Suggestions" : locale === "es" ? "Sugerencias" : "Suggestions"}
              </p>
              {suggestions.map((product) => (
                <button
                  key={product.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleProductSelect(product)}
                  className="w-full text-left px-3 py-2 hover:bg-accent rounded-md flex items-center gap-3"
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-muted shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">{product.name}</p>
                    <p className="text-xs" style={{ color: primaryColor }}>{formatPrice(product.price)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
