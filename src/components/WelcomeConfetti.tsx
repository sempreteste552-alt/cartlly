import { useEffect, useState } from "react";
import confetti from "canvas-confetti";

interface WelcomeConfettiProps {
  userName: string;
  isNewAccount?: boolean;
}

export function WelcomeConfetti({ userName, isNewAccount }: WelcomeConfettiProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Fire confetti
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#6d28d9", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#6d28d9", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const firstName = userName?.split(" ")[0] || userName;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div
        className={`px-6 py-3 rounded-xl shadow-2xl border backdrop-blur-sm ${
          isNewAccount
            ? "bg-blue-500/90 border-blue-400/50 text-white"
            : "bg-emerald-500/90 border-emerald-400/50 text-white"
        }`}
      >
        <p className="text-sm font-semibold text-center">
          {isNewAccount
            ? `🎉 Conta criada com sucesso! Bem-vindo à plataforma, ${firstName}!`
            : `👋 Bem-vindo de volta, ${firstName}!`}
        </p>
      </div>
    </div>
  );
}
