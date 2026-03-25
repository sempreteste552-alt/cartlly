import { useState, useEffect, useCallback, useRef } from "react";
import { Package } from "lucide-react";

interface ProductImageSlideshowProps {
  mainImage: string | null;
  additionalImages?: string[];
  alt: string;
  className?: string;
  autoplaySpeed?: number;
}

export function ProductImageSlideshow({
  mainImage,
  additionalImages = [],
  alt,
  className = "",
  autoplaySpeed = 1000,
}: ProductImageSlideshowProps) {
  const allImages = [mainImage, ...additionalImages].filter(Boolean) as string[];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoplay = useCallback(() => {
    if (allImages.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % allImages.length);
    }, autoplaySpeed);
  }, [allImages.length, autoplaySpeed]);

  const stopAutoplay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCurrentIndex(0);
  }, []);

  useEffect(() => {
    if (isHovering) {
      startAutoplay();
    } else {
      stopAutoplay();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isHovering, startAutoplay, stopAutoplay]);

  if (allImages.length === 0) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gray-50 ${className}`}>
        <Package className="h-12 w-12 text-gray-300" />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {allImages.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`${alt} ${i + 1}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            i === currentIndex ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
        />
      ))}

      {/* Dot indicators */}
      {allImages.length > 1 && isHovering && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {allImages.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
