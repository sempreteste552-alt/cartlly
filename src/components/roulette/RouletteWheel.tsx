import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Prize {
  id: string;
  label: string;
  color?: string;
}

interface RouletteWheelProps {
  prizes: Prize[];
  onFinish: (prize: Prize) => void;
  isSpinning?: boolean;
  spinningDuration?: number; // in seconds
}

export function RouletteWheel({
  prizes,
  onFinish,
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

  const spin = () => {
    if (isSpinning || prizes.length === 0) return;

    setIsSpinning(true);
    
    // Choose a random prize
    const prizeIndex = Math.floor(Math.random() * prizes.length);
    const degreesPerPrize = 360 / prizes.length;
    
    // Calculate new rotation:
    // Current rotation + some full spins (5-10) + offset to land on the prize
    // The pointer is usually at the top (0 deg). 
    // Prize 0 is at [0, degreesPerPrize]
    // To land on prize index i, the wheel needs to be at -(i * degreesPerPrize + offset)
    const extraSpins = 5 + Math.floor(Math.random() * 5);
    const prizeOffset = Math.random() * (degreesPerPrize * 0.8) + (degreesPerPrize * 0.1);
    const finalRotation = rotation + (extraSpins * 360) + (360 - (prizeIndex * degreesPerPrize + prizeOffset));

    setRotation(finalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      onFinish(prizes[prizeIndex]);
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
      {/* Pointer */}
      <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-10">
        <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-red-600 drop-shadow-md" />
      </div>

      {/* Wheel Container */}
      <div className="relative w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] rounded-full border-8 border-gray-800 overflow-hidden shadow-2xl bg-white">
        <div
          className="absolute inset-0 transition-transform cubic-bezier(0.15, 0, 0.15, 1)"
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
                  "absolute top-0 right-0 w-1/2 h-1/2 origin-bottom-left flex items-end justify-center pb-8",
                  getPrizeColor(i)
                )}
                style={{
                  transform: `rotate(${rotate}deg) skewY(-${skew}deg)`,
                }}
              >
                <div
                  className="flex flex-col items-center justify-center text-white font-bold text-center"
                  style={{
                    transform: `skewY(${skew}deg) rotate(${angle / 2}deg) translateY(-40px)`,
                    width: "120px",
                  }}
                >
                  <span className="text-xs sm:text-sm drop-shadow-sm line-clamp-2 px-2">
                    {prize.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center Circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800 rounded-full border-4 border-white z-20 shadow-md flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        </div>
      </div>

      <Button
        className="mt-8 px-12 py-6 text-xl font-bold rounded-full shadow-lg hover:scale-105 transition-transform"
        onClick={spin}
        disabled={isSpinning || prizes.length === 0}
      >
        {isSpinning ? "Girando..." : "GIRAR AGORA!"}
      </Button>
    </div>
  );
}
