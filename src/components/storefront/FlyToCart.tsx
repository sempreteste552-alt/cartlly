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
 * Global "fly to cart" animation system.
 * Listens to window event "fly-to-cart" with detail: { sourceEl, image?, color? }
 * Renders an absolutely-positioned image/dot that arcs from source → cart icon (data-cart-icon).
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

      // Find visible cart icon (mobile bottom nav OR desktop header)
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
        color: detail?.color || "#000",
      };

      setFlights((prev) => [...prev, flight]);

      // Trigger cart bounce on arrival
      setTimeout(() => {
        target.classList.add("cart-bounce");
        setTimeout(() => target.classList.remove("cart-bounce"), 600);
      }, 750);

      // Cleanup
      setTimeout(() => {
        setFlights((prev) => prev.filter((f) => f.id !== flight.id));
      }, 1100);
    };

    window.addEventListener("fly-to-cart", handler);
    return () => window.removeEventListener("fly-to-cart", handler);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {flights.map((f) => (
        <div
          key={f.id}
          className="fly-to-cart-item"
          style={{
            left: f.startX,
            top: f.startY,
            // CSS variables drive the animation
            ["--end-x" as any]: `${f.endX - f.startX}px`,
            ["--end-y" as any]: `${f.endY - f.startY}px`,
            backgroundColor: f.image ? undefined : f.color,
            backgroundImage: f.image ? `url(${f.image})` : undefined,
          }}
        />
      ))}
    </div>
  );
}

/** Helper to dispatch the fly-to-cart event from any "Add to cart" button */
export function flyToCart(sourceEl: HTMLElement | null, options?: { image?: string | null; color?: string }) {
  if (!sourceEl) return;
  window.dispatchEvent(
    new CustomEvent("fly-to-cart", {
      detail: { sourceEl, image: options?.image, color: options?.color },
    })
  );
}
