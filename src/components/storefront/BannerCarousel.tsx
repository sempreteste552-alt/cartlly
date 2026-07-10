import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

interface Banner {
  id: string;
  image_url: string;
  link_url?: string | null;
  media_type?: string;
  category_id?: string | null;
}

const ROTATE_DURATION = 8000;

export function BannerCarousel({ banners, mobileFormat = "landscape", basePath = "" }: { banners: Banner[]; mobileFormat?: string; basePath?: string }) {
  const [current, setCurrent] = useState(0);
  const [openedVideo, setOpenedVideo] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const goTo = useCallback(
    (idx: number) => setCurrent((idx + banners.length) % banners.length),
    [banners.length]
  );
  const goNext = useCallback(
    () => setCurrent((prev) => (prev + 1) % banners.length),
    [banners.length]
  );
  const goPrev = useCallback(
    () => setCurrent((prev) => (prev - 1 + banners.length) % banners.length),
    [banners.length]
  );

  // Simple rotation — never autoplay videos (keeps stores lightweight)
  useEffect(() => {
    if (banners.length < 2) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(goNext, ROTATE_DURATION);
    return () => clearTimeout(timerRef.current);
  }, [banners, current, goNext]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  if (!banners.length) return null;

  const mobileAspect =
    mobileFormat === "square" ? "aspect-square" :
    mobileFormat === "portrait" ? "aspect-[4/5]" :
    "h-48";

  return (
    <div className="max-w-7xl mx-auto px-4 pt-4">
      <div className={`relative w-full ${mobileAspect} sm:h-64 md:h-80 rounded-lg overflow-hidden bg-muted`}>
        {banners.map((banner, index) => {
          const active = index === current;
          const isVideo = banner.media_type === "video";
          const opened = !!openedVideo[banner.id];
          const href = banner.category_id ? `${basePath}?categoria=${banner.category_id}` : banner.link_url;

          return (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-700 ${active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
            >
              {isVideo ? (
                opened && active ? (
                  <video
                    src={banner.image_url}
                    className="w-full h-full object-contain bg-black"
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenedVideo((prev) => ({ ...prev, [banner.id]: true }))}
                    className="relative w-full h-full flex items-center justify-center bg-black group"
                    aria-label="Reproduzir vídeo"
                  >
                    <video
                      src={`${banner.image_url}#t=0.1`}
                      className="absolute inset-0 w-full h-full object-contain opacity-70"
                      preload="metadata"
                      muted
                      playsInline
                    />
                    <span className="relative z-10 rounded-full bg-white/90 p-4 shadow-lg transition-transform group-hover:scale-110">
                      <Play className="h-8 w-8 fill-black text-black" />
                    </span>
                  </button>
                )
              ) : (
                <MaybeLink href={href} disabled={!active}>
                  <img
                    src={banner.image_url}
                    alt="Banner"
                    className={`w-full h-full object-contain ${active ? "animate-ken-burns" : ""}`}
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </MaybeLink>
              )}
            </div>
          );
        })}

        {banners.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/40 p-1.5 text-white transition-colors hover:bg-black/60"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/40 p-1.5 text-white transition-colors hover:bg-black/60"
              aria-label="Próximo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {banners.length > 1 && (
          <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => goTo(index)}
                className={`h-2 rounded-full transition-all ${index === current ? "w-6 bg-white" : "w-2 bg-white/50"}`}
                aria-label={`Ir para banner ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MaybeLink({
  href,
  children,
  disabled = false,
}: {
  href?: string | null;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const navigate = useNavigate();

  if (href && !disabled) {
    const isInternal = (() => {
      try {
        const url = new URL(href, window.location.origin);
        return url.origin === window.location.origin;
      } catch {
        return href.startsWith("/");
      }
    })();

    if (isInternal) {
      const path = (() => {
        try {
          const url = new URL(href, window.location.origin);
          return url.pathname + url.search + url.hash;
        } catch {
          return href;
        }
      })();

      return (
        <div className="block h-full w-full cursor-pointer" onClick={() => navigate(path)}>
          {children}
        </div>
      );
    }

    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
        {children}
      </a>
    );
  }

  return <div className="h-full w-full">{children}</div>;
}
