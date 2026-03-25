import { useEffect, useRef } from "react";

interface StoreMarqueeProps {
  text: string;
  speed?: number;
  bgColor?: string;
  textColor?: string;
}

export function StoreMarquee({ text, speed = 50, bgColor = "#000000", textColor = "#ffffff" }: StoreMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!text?.trim()) return null;

  // Speed: 1-100 maps to animation duration 30s-5s
  const duration = Math.max(5, 35 - (speed / 100) * 30);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden whitespace-nowrap py-2 text-sm font-medium"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <div
        className="inline-block animate-marquee"
        style={{
          animation: `marquee ${duration}s linear infinite`,
        }}
      >
        <span className="mx-8">{text}</span>
        <span className="mx-8">{text}</span>
        <span className="mx-8">{text}</span>
        <span className="mx-8">{text}</span>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
