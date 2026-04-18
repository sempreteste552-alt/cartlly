import { useEffect, useState } from "react";

interface FlyEvent {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  image?: string | null;
  color: string;
}

/**
 * Global "gift to cart" animation.
 * Listens to window event "fly-to-cart" with detail: { sourceEl, image?, color? }
 * Renders a gift box being wrapped around the product, then arcs to the cart icon.
 */
export function FlyToCart() {
  const [flights, setFlights] = useState<FlyEvent[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        sourceEl?: HTMLElement;
        image?: string | null;
        color?: string;
      };
      const sourceEl = detail?.sourceEl;
      if (!sourceEl) return;

      const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-icon]"));
      const target = candidates.find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (!target) return;

      const sRect = sourceEl.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();

      const flight: FlyEvent = {
        id: Date.now() + Math.random(),
        startX: sRect.left + sRect.width / 2,
        startY: sRect.top + sRect.height / 2,
        endX: tRect.left + tRect.width / 2,
        endY: tRect.top + tRect.height / 2,
        image: detail?.image || null,
        color: detail?.color || "#e11d48",
      };

      setFlights((prev) => [...prev, flight]);

      // Cart bounces when gift arrives (after wrap + fly = ~1500ms)
      setTimeout(() => {
        target.classList.add("cart-bounce");
        setTimeout(() => target.classList.remove("cart-bounce"), 600);
      }, 1500);

      // Cleanup after full animation
      setTimeout(() => {
        setFlights((prev) => prev.filter((f) => f.id !== flight.id));
      }, 2000);
    };

    window.addEventListener("fly-to-cart", handler);
    return () => window.removeEventListener("fly-to-cart", handler);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {flights.map((f) => (
        <div
          key={f.id}
          className="gift-fly-wrapper"
          style={{
            left: f.startX,
            top: f.startY,
            ["--end-x" as any]: `${f.endX - f.startX}px`,
            ["--end-y" as any]: `${f.endY - f.startY}px`,
            ["--ribbon-color" as any]: f.color,
          }}
        >
          {/* Product image (visible during wrap, hidden when ribbons close) */}
          {f.image && (
            <div
              className="gift-product"
              style={{ backgroundImage: `url(${f.image})` }}
            />
          )}

          {/* Gift box body (kraft/cream color) */}
          <div className="gift-box" />

          {/* Ribbon (vertical) */}
          <div className="gift-ribbon-v" />
          {/* Ribbon (horizontal) */}
          <div className="gift-ribbon-h" />
          {/* Bow */}
          <div className="gift-bow">
            <span className="gift-bow-loop gift-bow-left" />
            <span className="gift-bow-loop gift-bow-right" />
            <span className="gift-bow-knot" />
          </div>

          {/* Sparkles */}
          <span className="gift-spark gift-spark-1">✨</span>
          <span className="gift-spark gift-spark-2">✨</span>
          <span className="gift-spark gift-spark-3">✨</span>
        </div>
      ))}
    </div>
  );
}

/** Helper to dispatch the gift animation event from any "Add to cart" button */
export function flyToCart(
  sourceEl: HTMLElement | null,
  options?: { image?: string | null; color?: string }
) {
  if (!sourceEl) return;
  window.dispatchEvent(
    new CustomEvent("fly-to-cart", {
      detail: { sourceEl, image: options?.image, color: options?.color },
    })
  );
}
