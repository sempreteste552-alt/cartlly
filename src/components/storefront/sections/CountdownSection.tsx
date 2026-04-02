import { useState, useEffect } from "react";
import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";

interface Props {
  section: StoreHomeSection;
  primaryColor: string;
}

export function CountdownSection({ section, primaryColor }: Props) {
  const endDate = (section.config as any)?.end_date;
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!endDate) return;
    const target = new Date(endDate).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setExpired(true);
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  if (expired || !endDate) return null;

  return (
    <div
      className="py-6 text-center text-white"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="max-w-7xl mx-auto px-4">
        {section.title && <h2 className="text-xl md:text-2xl font-bold mb-4">{section.title}</h2>}
        {section.subtitle && <p className="mb-4 opacity-90">{section.subtitle}</p>}
        <div className="flex justify-center gap-4">
          {[
            { label: "Dias", value: timeLeft.days },
            { label: "Horas", value: timeLeft.hours },
            { label: "Min", value: timeLeft.minutes },
            { label: "Seg", value: timeLeft.seconds },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/20 backdrop-blur rounded-lg px-4 py-3 min-w-[70px]">
              <div className="text-2xl md:text-4xl font-bold">{String(value).padStart(2, "0")}</div>
              <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
            </div>
          ))}
        </div>
        {section.button_text && section.button_link && (
          <a
            href={section.button_link}
            className="inline-block mt-4 px-6 py-2 bg-white rounded-full font-semibold"
            style={{ color: primaryColor }}
          >
            {section.button_text}
          </a>
        )}
      </div>
    </div>
  );
}
