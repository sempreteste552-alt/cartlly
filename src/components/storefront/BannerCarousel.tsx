import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BannerItem {
  id: string;
  image_url: string;
  link_url?: string | null;
  media_type?: string;
}

interface Props {
  banners: BannerItem[];
  imageInterval?: number; // ms, default 10000
}

export function BannerCarousel({ banners, imageInterval = 10000 }: Props) {
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = banners.length;
  const banner = banners[current];
  const isVideo = banner?.media_type === "video";

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; }
  }, []);

  const goTo = useCallback((index: number) => {
    clearTimers();
    // Stop current video/audio
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current = null;
    }
    setProgress(0);
    setCurrent((index + total) % total);
  }, [total, clearTimers]);

  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);
  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Auto-advance for images
  useEffect(() => {
    if (!banner || isVideo || total <= 1) return;

    const startTime = Date.now();
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min((elapsed / imageInterval) * 100, 100));
    }, 50);

    timerRef.current = setTimeout(() => {
      goTo(current + 1);
    }, imageInterval);

    return clearTimers;
  }, [current, banner, isVideo, total, imageInterval, clearTimers, goTo]);

  // Video ended handler
  const handleVideoEnded = useCallback(() => {
    goTo(current + 1);
  }, [current, goTo]);

  // Track video progress
  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current && videoRef.current.duration) {
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  }, []);

  if (!banners.length) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-xl group">
      {/* Media */}
      <div className="relative w-full h-48 sm:h-64 md:h-80">
        {isVideo ? (
          <video
            key={banner.id}
            ref={(el) => { videoRef.current = el; }}
            src={banner.image_url}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnded}
            onTimeUpdate={handleVideoTimeUpdate}
          />
        ) : banner.link_url ? (
          <a href={banner.link_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
            <img
              key={banner.id}
              src={banner.image_url}
              alt="Banner"
              className="w-full h-full object-cover transition-opacity duration-500"
            />
          </a>
        ) : (
          <img
            key={banner.id}
            src={banner.image_url}
            alt="Banner"
            className="w-full h-full object-cover transition-opacity duration-500"
          />
        )}
      </div>

      {/* Progress bar */}
      {total > 1 && (
        <div className="absolute bottom-0 left-0 right-0 flex gap-1 px-3 pb-3 z-10">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="flex-1 h-1 rounded-full overflow-hidden bg-white/30 backdrop-blur-sm cursor-pointer"
            >
              <div
                className="h-full rounded-full bg-white transition-all duration-100 ease-linear"
                style={{
                  width: i === current ? `${progress}%` : i < current ? "100%" : "0%",
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Navigation arrows */}
      {total > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 text-white hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onClick={goPrev}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 text-white hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onClick={goNext}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* Slide counter */}
      {total > 1 && (
        <div className="absolute top-3 right-3 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm z-10">
          {current + 1}/{total}
        </div>
      )}
    </div>
  );
}
