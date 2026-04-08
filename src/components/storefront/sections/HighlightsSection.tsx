import { useState, useEffect, useRef, useCallback } from "react";
import { usePublicHighlights, type StoreHighlight, type StoreHighlightItem } from "@/hooks/useStoreHighlights";
import { X, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

interface Props {
  storeUserId?: string;
  primaryColor: string;
}

export function HighlightsSection({ storeUserId, primaryColor }: Props) {
  const { data: highlights } = usePublicHighlights(storeUserId);
  const [viewing, setViewing] = useState<StoreHighlight | null>(null);

  if (!highlights || highlights.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="flex gap-4 overflow-x-auto pb-2 px-1 scrollbar-hide">
        {highlights.map((h) => (
          <button
            key={h.id}
            onClick={() => setViewing(h)}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <div
              className="w-[72px] h-[72px] rounded-full p-[3px] transition-transform group-hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, hsl(280 80% 60%))` }}
            >
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-background bg-muted">
                {h.cover_url ? (
                  <img src={h.cover_url} alt={h.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                    {h.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className="text-xs font-medium text-foreground truncate max-w-[76px]">{h.name}</span>
          </button>
        ))}
      </div>

      {viewing && (
        <StoryViewer
          highlight={viewing}
          onClose={() => setViewing(null)}
          primaryColor={primaryColor}
        />
      )}
    </div>
  );
}

function StoryViewer({
  highlight,
  onClose,
  primaryColor,
}: {
  highlight: StoreHighlight;
  onClose: () => void;
  primaryColor: string;
}) {
  const items = (highlight.items || []).sort((a, b) => a.sort_order - b.sort_order);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const DURATION = 10000; // 10 seconds for images

  const goNext = useCallback(() => {
    if (current < items.length - 1) {
      setCurrent((p) => p + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [current, items.length, onClose]);

  const goPrev = useCallback(() => {
    if (current > 0) {
      setCurrent((p) => p - 1);
      setProgress(0);
    }
  }, [current]);

  // Image auto-advance timer (10s)
  useEffect(() => {
    if (paused || !items[current] || items[current].media_type === "video") return;
    const interval = 50;
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        const next = p + (interval / DURATION) * 100;
        if (next >= 100) {
          goNext();
          return 0;
        }
        return next;
      });
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [current, paused, goNext, items]);

  // Video progress tracking
  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  }, []);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  if (items.length === 0) return null;

  const item = items[current];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <div
        className="relative w-full max-w-md h-[85vh] max-h-[700px] bg-black rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
          {items.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  backgroundColor: primaryColor,
                  width: i < current ? "100%" : i === current ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-4 left-0 right-0 z-10 flex items-center justify-between px-4 pt-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full overflow-hidden border-2"
              style={{ borderColor: primaryColor }}
            >
              {highlight.cover_url ? (
                <img src={highlight.cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-xs font-bold text-white">
                  {highlight.name.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-white text-sm font-semibold">{highlight.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPaused((p) => !p)} className="text-white/80 hover:text-white">
              {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="w-full h-full flex items-center justify-center">
          {item.media_type === "video" ? (
            <video
              ref={videoRef}
              key={item.id}
              src={item.media_url}
              className="w-full h-full object-contain"
              autoPlay
              playsInline
              onEnded={goNext}
              onTimeUpdate={handleVideoTimeUpdate}
              onPause={() => setPaused(true)}
              onPlay={() => setPaused(false)}
            />
          ) : (
            <img
              key={item.id}
              src={item.media_url}
              alt=""
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Navigation zones (touch) */}
        <button
          className="absolute left-0 top-16 bottom-16 w-1/3 z-10"
          onClick={goPrev}
          aria-label="Anterior"
        />
        <button
          className="absolute right-0 top-16 bottom-16 w-1/3 z-10"
          onClick={goNext}
          aria-label="Próximo"
        />

        {/* Left arrow - always visible */}
        {current > 0 && (
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/50 rounded-full p-2 text-white/90 hover:text-white hover:bg-black/70 transition-all"
            onClick={goPrev}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {/* Right arrow - always visible */}
        {current < items.length - 1 && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/50 rounded-full p-2 text-white/90 hover:text-white hover:bg-black/70 transition-all"
            onClick={goNext}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
