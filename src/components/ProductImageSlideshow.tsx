import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Package, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX } from "lucide-react";

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
    if (!showArrows) return; // Don't intercept touches in card mode
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!showArrows) return; // Don't intercept touches in card mode
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

  // Ken Burns slow zoom cycle
  const [zoomKey, setZoomKey] = useState(0);
  useEffect(() => {
    setZoomKey((k) => k + 1);
  }, [currentIndex]);

  if (visibleImages.length === 0) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-muted/30 ${className}`}>
        <Package className="h-12 w-12 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <style>{`
        @keyframes kenburns-in {
          0% { transform: scale(1); }
          100% { transform: scale(1.08); }
        }
        @keyframes kenburns-out {
          0% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .kenburns-zoom {
          animation: kenburns-in ${autoplaySpeed > 2000 ? autoplaySpeed / 1000 : 6}s ease-in-out forwards;
        }
        .kenburns-zoom-single {
          animation: kenburns-in 8s ease-in-out alternate infinite;
        }
      `}</style>
      <div
        className={`relative min-h-0 flex-1 overflow-hidden group ${className}`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {visibleImages.map((src, i) => {
          const isVideo = src.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv|mov)$/i) || src.includes("product-videos");
          
          if (isVideo) {
            return (
              <div
                key={`${src}-${i}`}
                className={`absolute inset-0 h-full w-full transition-opacity duration-700 ease-in-out ${
                  i === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
              >
                <video
                  src={src}
                  className="h-full w-full object-cover"
                  autoPlay={i === currentIndex}
                  loop
                  muted
                  playsInline
                  controls={i === currentIndex}
                />
              </div>
            );
          }

          return (
            <img
              key={`${src}-${i === currentIndex ? zoomKey : 'idle'}`}
              src={src}
              alt={`${alt} ${i + 1}`}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${
                i === currentIndex
                  ? `opacity-100 ${visibleImages.length === 1 ? "kenburns-zoom-single" : "kenburns-zoom"}`
                  : "opacity-0"
              }`}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
              draggable={false}
              onError={() => handleImageError(src)}
            />
          );
        })}

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
