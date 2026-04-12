import { useState, useMemo, useEffect } from "react";
import { Filter, X, ChevronDown, Check } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/i18n";
import { usePublicCategories } from "@/hooks/usePublicStore";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface StoreFilterProps {
  storeUserId: string;
  primaryColor?: string;
  products: any[];
}

export function StoreFilter({ storeUserId, primaryColor = "#6d28d9", products }: StoreFilterProps) {
  const { t, locale } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categories } = usePublicCategories(storeUserId);
  const [isOpen, setIsOpen] = useState(false);

  // Local state for filters before applying
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string[]>>({});
  const [availableVariants, setAvailableVariants] = useState<Record<string, string[]>>({});

  // Sync with searchParams when opening
  useEffect(() => {
    if (isOpen) {
      const cat = searchParams.get("categoria");
      setSelectedCategories(cat ? cat.split(",") : []);
      
      const minP = searchParams.get("min_price");
      const maxP = searchParams.get("max_price");
      setPriceRange([minP ? Number(minP) : 0, maxP ? Number(maxP) : 10000]);

      // Variants from searchParams: v_Cor=Preto,Branco&v_Tamanho=P,M
      const variants: Record<string, string[]> = {};
      searchParams.forEach((val, key) => {
        if (key.startsWith("v_")) {
          variants[key.replace("v_", "")] = val.split(",");
        }
      });
      setSelectedVariants(variants);
    }
  }, [isOpen, searchParams]);

  // Fetch unique variants for the store's products
  useEffect(() => {
    async function fetchVariants() {
      if (!storeUserId) return;
      const { data, error } = await supabase
        .from("product_variants")
        .select("variant_type, variant_value")
        .in("product_id", products.map(p => p.id));
      
      if (error) return;

      const grouped: Record<string, Set<string>> = {};
      data.forEach(v => {
        if (!grouped[v.variant_type]) grouped[v.variant_type] = new Set();
        grouped[v.variant_type].add(v.variant_value);
      });

      const result: Record<string, string[]> = {};
      Object.entries(grouped).forEach(([key, values]) => {
        result[key] = Array.from(values).sort();
      });
      setAvailableVariants(result);
    }
    if (products.length > 0) fetchVariants();
  }, [storeUserId, products]);

  const maxProductPrice = useMemo(() => {
    if (!products.length) return 10000;
    return Math.max(...products.map(p => p.price));
  }, [products]);

  const handleApply = () => {
    const newParams = new URLSearchParams(searchParams);
    
    if (selectedCategories.length > 0) {
      newParams.set("categoria", selectedCategories.join(","));
    } else {
      newParams.delete("categoria");
    }

    if (priceRange[0] > 0) newParams.set("min_price", priceRange[0].toString());
    else newParams.delete("min_price");

    if (priceRange[1] < maxProductPrice) newParams.set("max_price", priceRange[1].toString());
    else newParams.delete("max_price");

    // Remove all variant params first
    Array.from(newParams.keys()).forEach(key => {
      if (key.startsWith("v_")) newParams.delete(key);
    });

    // Add selected variants
    Object.entries(selectedVariants).forEach(([key, values]) => {
      if (values.length > 0) {
        newParams.set(`v_${key}`, values.join(","));
      }
    });

    setSearchParams(newParams);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedCategories([]);
    setPriceRange([0, maxProductPrice]);
    setSelectedVariants({});
    setSearchParams({});
    setIsOpen(false);
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleVariant = (type: string, value: string) => {
    setSelectedVariants(prev => {
      const current = prev[type] || [];
      const updated = current.includes(value) 
        ? current.filter(v => v !== value) 
        : [...current, value];
      
      return { ...prev, [type]: updated };
    });
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchParams.has("categoria")) count++;
    if (searchParams.has("min_price") || searchParams.has("max_price")) count++;
    searchParams.forEach((_, key) => {
      if (key.startsWith("v_")) count++;
    });
    return count;
  }, [searchParams]);

  const filterText = {
    pt: { title: "Filtros", clear: "Limpar", apply: "Aplicar", categories: "Categorias", price: "Preço", variants: "Atributos", from: "De", to: "Até" },
    en: { title: "Filters", clear: "Clear", apply: "Apply", categories: "Categories", price: "Price", variants: "Attributes", from: "From", to: "To" },
    es: { title: "Filtros", clear: "Limpiar", apply: "Aplicar", categories: "Categorías", price: "Precio", variants: "Atributos", from: "De", to: "Hasta" },
    fr: { title: "Filtres", clear: "Effacer", apply: "Appliquer", categories: "Catégories", price: "Prix", variants: "Attributs", from: "De", to: "À" },
  }[locale] || { title: "Filters", clear: "Clear", apply: "Apply", categories: "Categories", price: "Price", variants: "Attributes", from: "From", to: "To" };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-2 h-10 px-3">
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">{filterText.title}</span>
          {activeFiltersCount > 0 && (
            <Badge 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
              style={{ backgroundColor: primaryColor, color: "#fff" }}
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col h-full p-0">
        <SheetHeader className="p-6 pb-2 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold">{filterText.title}</SheetTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleClear}>
              {filterText.clear}
            </Button>
          </div>
        </SheetHeader>
        
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-8">
            {/* Price Range */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">{filterText.price}</Label>
              <div className="px-2">
                <Slider
                  min={0}
                  max={maxProductPrice}
                  step={1}
                  value={[priceRange[0], priceRange[1]]}
                  onValueChange={(val) => setPriceRange([val[0], val[1]])}
                  className="mt-6"
                />
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">{filterText.from}: </span>
                    <span className="font-medium">R$ {priceRange[0]}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">{filterText.to}: </span>
                    <span className="font-medium">R$ {priceRange[1]}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Categories */}
            {categories && categories.length > 0 && (
              <div className="space-y-4">
                <Label className="text-base font-semibold">{filterText.categories}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
                        ${selectedCategories.includes(cat.id) 
                          ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                          : 'border-border hover:border-primary/50'}
                      `}
                    >
                      <div className={`
                        w-4 h-4 rounded-sm border flex items-center justify-center
                        ${selectedCategories.includes(cat.id) ? 'bg-primary border-primary' : 'border-muted-foreground/30'}
                      `}>
                        {selectedCategories.includes(cat.id) && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-sm truncate">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Dynamic Variants */}
            {Object.keys(availableVariants).length > 0 && (
              <div className="space-y-4">
                <Label className="text-base font-semibold">{filterText.variants}</Label>
                <Accordion type="multiple" className="w-full">
                  {Object.entries(availableVariants).map(([type, values]) => (
                    <AccordionItem key={type} value={type} className="border-none">
                      <AccordionTrigger className="py-2 hover:no-underline capitalize">
                        <span className="text-sm font-medium">{type}</span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-wrap gap-2 pt-1 pb-2">
                          {values.map((val) => (
                            <Badge
                              key={val}
                              variant={selectedVariants[type]?.includes(val) ? "default" : "outline"}
                              className="cursor-pointer px-3 py-1 text-xs font-normal capitalize"
                              style={selectedVariants[type]?.includes(val) ? { backgroundColor: primaryColor, color: '#fff' } : {}}
                              onClick={() => toggleVariant(type, val)}
                            >
                              {val}
                            </Badge>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="p-6 border-t mt-auto">
          <Button 
            className="w-full h-12 text-base font-bold" 
            style={{ backgroundColor: primaryColor, color: '#fff' }}
            onClick={handleApply}
          >
            {filterText.apply}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
