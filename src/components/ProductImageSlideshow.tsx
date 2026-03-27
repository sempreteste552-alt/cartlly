import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Package, ChevronLeft, ChevronRight } from "lucide-react";

interface ProductImageSlideshowProps {
  mainImage: string | null;
  additionalImages?: string[];
  alt: string;
  className?: string;
  autoplaySpeed?: number;
  showThumbnails?: boolean;
  showArrows?: boolean;
  glowColor?: string;
}

export function ProductImageSlideshow({
  mainImage,
  additionalImages = [],
  alt,
  className = "",
  autoplaySpeed = 3000,
  showThumbnails = false,
  showArrows = false,
  glowColor,
}: ProductImageSlideshowProps) {
  const allImages = useMemo(
    () => [...new Set([mainImage, ...additionalImages].filter((image): image is string => Boolean(image?.trim())))],
    [mainImage, additionalImages]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const visibleImages = useMemo(
    () => allImages.filter((image) => !failedImages.includes(image)),
    [allImages, failedImages]
  );

  const stopAutoplay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startAutoplay = useCallback(() => {
    if (visibleImages.length <= 1) return;
    stopAutoplay();
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleImages.length);
    }, autoplaySpeed);
  }, [autoplaySpeed, stopAutoplay, visibleImages.length]);

  useEffect(() => {
    if (currentIndex >= visibleImages.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, visibleImages.length]);

  useEffect(() => {
    if (!isHovering) startAutoplay();
    else stopAutoplay();
    return () => stopAutoplay();
  }, [isHovering, startAutoplay, stopAutoplay]);

  const goTo = (index: number) => {
    setCurrentIndex(index);
    if (!isHovering) startAutoplay();
  };

  const goNext = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!visibleImages.length) return;
    goTo((currentIndex + 1) % visibleImages.length);
  };

  const goPrev = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!visibleImages.length) return;
    goTo((currentIndex - 1 + visibleImages.length) % visibleImages.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    setTouchStart(null);
  };

  const handleImageError = (src: string) => {
    setFailedImages((prev) => (prev.includes(src) ? prev : [...prev, src]));
  };

  if (visibleImages.length === 0) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-muted/30 ${className}`}>
        <Package className="h-12 w-12 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div
        className={`relative min-h-0 flex-1 overflow-hidden group ${className}`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {visibleImages.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${alt} ${i + 1}`}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-in-out ${
              i === currentIndex ? "opacity-100 scale-100" : "opacity-0 scale-105"
            }`}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "auto"}
            decoding="async"
            draggable={false}
            onError={() => handleImageError(src)}
          />
        ))}

        {glowColor && (
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at center, ${glowColor}25 0%, transparent 70%)`,
              filter: "blur(20px)",
            }}
          />
        )}

        {showArrows && visibleImages.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/60 group-hover:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/60 group-hover:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {visibleImages.length > 1 && (
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1">
            {visibleImages.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  goTo(i);
                }}
                className={`rounded-full transition-all duration-300 ${
                  i === currentIndex ? "h-1.5 w-5 bg-white shadow-sm" : "h-1.5 w-1.5 bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {showThumbnails && visibleImages.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 px-0.5">
          {visibleImages.map((src, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goTo(i);
              }}
              className={`shrink-0 h-12 w-12 rounded-md overflow-hidden border-2 transition-all duration-200 ${
                i === currentIndex ? "ring-1 ring-offset-1 opacity-100" : "opacity-60 hover:opacity-90"
              }`}
              style={{ borderColor: i === currentIndex ? (glowColor || "#6d28d9") : "transparent" }}
            >
              <img
                src={src}
                alt={`${alt} thumb ${i + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                onError={() => handleImageError(src)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
