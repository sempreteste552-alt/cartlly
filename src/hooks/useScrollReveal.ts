import { useEffect, useRef, useState } from "react";

interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollRevealOptions = {}
) {
  const { threshold = 0.1, rootMargin = "0px 0px -40px 0px", once = true } = options;
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Immediate visibility check: if element is already in viewport on mount,
    // reveal it right away without waiting for a scroll event (mobile fix)
    const checkInitial = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      if (rect.top < vh && rect.bottom > 0 && rect.left < vw && rect.right > 0) {
        setIsVisible(true);
        return true;
      }
      return false;
    };

    const alreadyVisible = checkInitial();
    if (alreadyVisible && once) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    // Re-check after first paint in case layout shifted
    const raf = requestAnimationFrame(() => { checkInitial(); });
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, [threshold, rootMargin, once]);

  return { ref, isVisible };
}

export function useStaggeredReveal(itemCount: number, baseDelay = 60) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  
  const getItemStyle = (index: number): React.CSSProperties => ({
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
    transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * baseDelay}ms, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * baseDelay}ms`,
  });

  return { ref, isVisible, getItemStyle };
}
