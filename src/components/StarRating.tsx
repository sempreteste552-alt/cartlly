import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export function StarRating({ rating, maxStars = 5, size = 20, interactive = false, onChange }: StarRatingProps) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxStars }, (_, i) => {
        const starValue = i + 1;
        const filled = starValue <= rating;
        return (
          <Star
            key={i}
            className={cn(
              "transition-colors",
              filled ? "fill-yellow-400 text-yellow-400" : "text-gray-300",
              interactive && "cursor-pointer hover:text-yellow-400"
            )}
            size={size}
            onClick={() => interactive && onChange?.(starValue)}
          />
        );
      })}
    </div>
  );
}
