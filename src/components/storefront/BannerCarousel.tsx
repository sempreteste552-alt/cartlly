import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Banner {
  id: string;
  image_url: string;
  link_url?: string | null;
  media_type?: string;
}

const ZOOM_DURATION = 8000; // 8s zoom on images then advance

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0);
  const [zooming, setZooming] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const goTo = useCallback((idx: number) => {
    setCurrent(idx);
    setZooming(false);
    // Reset zoom animation
    requestAnimationFrame(() => setZooming(true));
  }, []);

  const goNext = useCallback(() => {
    goTo((current + 1) % banners.length);
  }, [current, banners.length, goTo]);

  const goPrev = useCallback(() => {
    goTo((current - 1 + banners.length) % banners.length);
  }, [current, banners.length, goTo]);

  // Auto-advance for images
  const banner = banners[current];
  const isVideo = (banner as any)?.media_type === "video";

  useEffect(() => {
    if (isVideo) return; // video advances on end
    timerRef.current = setTimeout(goNext, ZOOM_DURATION);
    return () => clearTimeout(timerRef.current);
  }, [current, isVideo, goNext]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  if (!banners.length) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 pt-4">
      <div className="relative w-full h-48 sm:h-64 md:h-80 rounded-lg overflow-hidden bg-muted">
        {/* Slides */}
        {banners.map((b, i) => {
          const active = i === current;
          const bIsVideo = (b as any)?.media_type === "video";

          return (
            <div
              key={b.id}
              className={`absolute inset-0 transition-opacity duration-700 ${active ? "opacity-100 z-10" : "opacity-0 z-0"}`}
            >
              {bIsVideo ? (
                <video
                  src={b.image_url}
                  className="w-full h-full object-cover"
                  autoPlay={active}
                  muted
                  playsInline
                  preload="metadata"
                  onEnded={goNext}
                  {...(!active && { pause: true } as any)}
                />
              ) : (
                <MaybeLink href={b.link_url}>
                  <img
                    src={b.image_url}
                    alt="Banner"
                    className={`w-full h-full object-cover transition-transform ${
                      active && zooming ? "animate-ken-burns" : ""
                    }`}
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </MaybeLink>
              )}
            </div>
          );
        })}

        {/* Arrows */}
        {banners.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 rounded-full p-1.5 text-white transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 rounded-full p-1.5 text-white transition-colors"
              aria-label="Próximo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Dots */}
        {banners.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current ? "w-6 bg-white" : "w-2 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MaybeLink({ href, children }: { href?: string | null; children: React.ReactNode }) {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
        {children}
      </a>
    );
  }
  return <>{children}</>;
}
