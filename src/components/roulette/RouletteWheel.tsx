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
    if (prizes[index].label === 'Não foi dessa vez') return "bg-slate-500/90";
    
    const colors = [
      "bg-gradient-to-br from-primary to-primary/80",
      "bg-gradient-to-br from-purple-600 to-purple-400",
      "bg-gradient-to-br from-pink-600 to-pink-400",
      "bg-gradient-to-br from-amber-500 to-amber-300",
      "bg-gradient-to-br from-emerald-600 to-emerald-400",
      "bg-gradient-to-br from-blue-600 to-blue-400",
      "bg-gradient-to-br from-indigo-600 to-indigo-400",
      "bg-gradient-to-br from-rose-600 to-rose-400",
    ];
    return prizes[index].color || colors[index % colors.length];
  };

  return (
    <div className="relative flex flex-col items-center group perspective-1000">
      {/* 3D Container with Rotation */}
      <div className="absolute inset-0 -m-12 pointer-events-none">
        {[...Array(24)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [1, 1.4, 1],
              rotate: [0, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.1,
              rotate: { duration: 20, repeat: Infinity, ease: "linear" }
            }}
            className="absolute w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_15px_rgba(250,204,21,1)]"
            style={{
              top: '50%',
              left: '50%',
              transform: `rotate(${i * 15}deg) translate(200px, -50%)`,
              sm: { transform: `rotate(${i * 15}deg) translate(250px, -50%)` }
            } as any}
          />
        ))}
      </div>


      {/* Enhanced Pointer with 3D feel */}
      <div className="absolute top-[-35px] left-1/2 -translate-x-1/2 z-40">
        <motion.div 
          animate={isSpinning ? { 
            rotate: [0, -15, 5, -10, 0],
            y: [0, -2, 0]
          } : {}}
          transition={{ duration: 0.15, repeat: isSpinning ? Infinity : 0 }}
          className="w-12 h-16 bg-gradient-to-b from-red-500 to-red-700 rounded-b-2xl shadow-2xl relative flex items-center justify-center border-x-4 border-b-4 border-white/30"
        >
          <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[20px] border-t-white absolute -top-2 drop-shadow-lg" />
          <div className="w-4 h-4 bg-white/20 rounded-full animate-ping" />
        </motion.div>
      </div>


      {/* Wheel Container with 3D shadow */}
      <div className="relative w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] rounded-full border-[16px] border-gray-950 overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8),inset_0_0_40px_rgba(0,0,0,0.8)] bg-gray-900 p-1 group-hover:scale-105 transition-transform duration-500">
        <div className="absolute inset-[-10px] rounded-full border-[10px] border-primary/20 animate-pulse pointer-events-none" />
        <div
          className="absolute inset-0 transition-transform cubic-bezier(0.1, 0, 0, 1) rounded-full overflow-hidden"
          style={{
            transform: `rotate(${rotation}deg) translateZ(0)`,
            transitionDuration: `${spinningDuration}s`,
            transformStyle: "preserve-3d"
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
                  className="flex flex-col items-center justify-center text-white font-black text-center drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]"
                  style={{
                    transform: `skewY(${skew}deg) rotate(${angle / 2}deg) translateY(-50px)`,
                    width: "140px",
                  }}
                >
                  <span className="text-[11px] sm:text-[12px] uppercase tracking-tighter mb-1 opacity-100 font-bold bg-black/50 px-3 py-0.5 rounded-full border border-white/20">
                    {prize.label.includes('%') ? 'Desconto' : prize.label === 'Não foi dessa vez' ? 'X' : 'Especial'}
                  </span>
                  <span className="text-sm sm:text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] line-clamp-2 px-1 leading-tight font-black">
                    {prize.label}
                  </span>
                  {prize.label !== 'Não foi dessa vez' && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Star className="w-4 h-4 mt-2 text-yellow-300 fill-yellow-300 shadow-xl" />
                    </motion.div>
                  )}
                </div>

              </div>
            );
          })}
        </div>

        {/* Premium Center Circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-gray-900 to-black rounded-full border-4 border-primary/50 z-20 shadow-[0_0_30px_rgba(var(--primary),0.4)] flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/30 via-transparent to-primary/10 animate-spin-slow" />
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-tr from-primary to-primary-foreground rounded-full border-2 border-white/20 z-10 shadow-2xl flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white animate-pulse drop-shadow-[0_0_10px_white]" />
          </div>
        </div>
      </div>

      <div className="mt-16 relative group">
        <div className="absolute -inset-2 bg-gradient-to-r from-primary via-purple-600 to-primary rounded-full blur-xl opacity-75 group-hover:opacity-100 transition duration-500 animate-pulse" />
        <Button
          className="relative px-16 py-10 text-3xl font-black rounded-full shadow-3xl hover:scale-110 active:scale-90 transition-all duration-500 bg-gray-950 border-4 border-primary/50 text-white hover:text-primary hover:border-primary overflow-hidden"
          onClick={spin}
          disabled={isSpinning || prizes.length === 0}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          {isSpinning ? (
            <span className="flex items-center gap-3">
              <span className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-3 h-3 bg-primary rounded-full animate-bounce" />
            </span>
          ) : (
            <span className="relative z-10 tracking-widest uppercase">GIRAR!</span>
          )}
        </Button>
      </div>

      
      <p className="mt-4 text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">
        Boa sorte • Tente ganhar • Prêmios VIP
      </p>
    </div>
  );
}
