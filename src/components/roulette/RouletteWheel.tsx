import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, useAnimation } from "framer-motion";
import { Sparkles, Star } from "lucide-react";

interface Prize {
  id: string;
  label: string;
  color?: string;
}

interface RouletteWheelProps {
  prizes: Prize[];
  onFinish: (prize: Prize) => void;
  onSpinStart?: () => Promise<Prize>;
  isSpinning?: boolean;
  spinningDuration?: number; // in seconds
}

export function RouletteWheel({
  prizes,
  onFinish,
  onSpinStart,
  isSpinning: controlledIsSpinning,
  spinningDuration = 5,
}: RouletteWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    if (controlledIsSpinning && !isSpinning) {
      spin();
    }
  }, [controlledIsSpinning]);

  const spin = async () => {
    if (isSpinning || prizes.length === 0) return;

    setIsSpinning(true);
    
    let targetPrize: Prize;
    
    if (onSpinStart) {
      try {
        targetPrize = await onSpinStart();
      } catch (e) {
        setIsSpinning(false);
        return;
      }
    } else {
      targetPrize = prizes[Math.floor(Math.random() * prizes.length)];
    }

    const prizeIndex = prizes.findIndex(p => p.id === targetPrize.id);
    if (prizeIndex === -1) {
      setIsSpinning(false);
      return;
    }

    const degreesPerPrize = 360 / prizes.length;
    const extraSpins = 5 + Math.floor(Math.random() * 5);
    const prizeOffset = Math.random() * (degreesPerPrize * 0.8) + (degreesPerPrize * 0.1);
    const finalRotation = rotation + (extraSpins * 360) + (360 - (prizeIndex * degreesPerPrize + prizeOffset));

    setRotation(finalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      onFinish(targetPrize);
    }, spinningDuration * 1000);
  };

  const getPrizeColor = (index: number) => {
    const colors = [
      "bg-primary",
      "bg-secondary",
      "bg-accent",
      "bg-muted",
      "bg-destructive",
      "bg-blue-500",
      "bg-green-500",
      "bg-orange-500",
    ];
    return prizes[index].color || colors[index % colors.length];
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Decorative Lights */}
      <div className="absolute inset-0 -m-8 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.2,
            }}
            className="absolute w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)]"
            style={{
              top: '50%',
              left: '50%',
              transform: `rotate(${i * 30}deg) translate(165px, -50%)`,
              sm: { transform: `rotate(${i * 30}deg) translate(215px, -50%)` }
            } as any}
          />
        ))}
      </div>

      {/* Pointer */}
      <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 z-30">
        <motion.div 
          animate={isSpinning ? { rotate: [0, -10, 0] } : {}}
          transition={{ duration: 0.1, repeat: isSpinning ? Infinity : 0 }}
          className="w-10 h-12 bg-red-600 rounded-b-full shadow-lg relative flex items-center justify-center border-2 border-white"
        >
          <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[15px] border-t-white absolute -top-1" />
        </motion.div>
      </div>

      {/* Wheel Container */}
      <div className="relative w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] rounded-full border-[12px] border-gray-900 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.3),inset_0_0_20px_rgba(0,0,0,0.5)] bg-gray-900 p-1">
        <div
          className="absolute inset-0 transition-transform cubic-bezier(0.15, 0, 0.15, 1) rounded-full overflow-hidden"
          style={{
            transform: `rotate(${rotation}deg)`,
            transitionDuration: `${spinningDuration}s`,
          }}
        >
          {prizes.map((prize, i) => {
            const angle = 360 / prizes.length;
            const rotate = i * angle;
            const skew = 90 - angle;

            return (
              <div
                key={prize.id}
                className={cn(
                  "absolute top-0 right-0 w-1/2 h-1/2 origin-bottom-left flex items-end justify-center pb-8 border-l border-white/10",
                  getPrizeColor(i)
                )}
                style={{
                  transform: `rotate(${rotate}deg) skewY(-${skew}deg)`,
                  background: `linear-gradient(45deg, var(--tw-bg-opacity, 1) 0%, rgba(255,255,255,0.1) 100%)`,
                }}
              >
                <div
                  className="flex flex-col items-center justify-center text-white font-bold text-center"
                  style={{
                    transform: `skewY(${skew}deg) rotate(${angle / 2}deg) translateY(-40px)`,
                    width: "120px",
                  }}
                >
                  <span className="text-[10px] sm:text-xs uppercase tracking-wider mb-1 opacity-80">Prêmio</span>
                  <span className="text-xs sm:text-sm drop-shadow-md line-clamp-2 px-2 leading-tight">
                    {prize.label}
                  </span>
                  {prize.label !== 'Não foi dessa vez' && (
                    <Star className="w-3 h-3 mt-1 text-yellow-300 fill-yellow-300 animate-pulse" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Center Circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 bg-gray-900 rounded-full border-4 border-gray-700 z-20 shadow-2xl flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/40 to-transparent animate-spin-slow" />
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-full border-2 border-white/20 z-10 shadow-inner flex items-center justify-center">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-pulse" />
          </div>
        </div>
      </div>

      <div className="mt-12 relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse" />
        <Button
          className="relative px-12 py-8 text-2xl font-black rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 bg-gray-900 border-2 border-primary text-white"
          onClick={spin}
          disabled={isSpinning || prizes.length === 0}
        >
          {isSpinning ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-75" />
              <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-150" />
            </span>
          ) : (
            "GIRAR AGORA!"
          )}
        </Button>
      </div>
      
      <p className="mt-4 text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">
        Boa sorte • Tente ganhar • Prêmios VIP
      </p>
    </div>
  );
}
