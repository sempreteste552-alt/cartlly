import { useState, useRef, useEffect } from "react";
import { useProductVideos } from "@/hooks/useProductVideos";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX, X, ShoppingCart, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/i18n";

interface VideoPlayerProps {
  video: any;
  isActive: boolean;
  onClose: () => void;
}

function VideoPlayer({ video, isActive, onClose }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isActive) {
      videoRef.current?.play().catch(() => {
        // Handle autoplay block
        setIsPlaying(false);
      });
    } else {
      videoRef.current?.pause();
    }
  }, [isActive]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        src={video.video_url}
        className="h-full w-full object-contain"
        loop
        muted={isMuted}
        playsInline
        onClick={togglePlay}
      />
      
      {/* Overlay Controls */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
        <div className="flex justify-between items-start pointer-events-auto">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)} className="text-white hover:bg-white/20">
            {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
          </Button>
        </div>

        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto" onClick={togglePlay}>
            <div className="p-4 bg-black/40 rounded-full backdrop-blur-sm">
              <Play className="h-12 w-12 text-white fill-white" />
            </div>
          </div>
        )}

        {/* Product Card at bottom */}
        <div className="mt-auto pointer-events-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 flex items-center gap-3">
            <img 
              src={video.product?.image_url} 
              alt={video.product?.name} 
              className="h-14 w-14 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-medium truncate text-sm">{video.product?.name}</h4>
              <p className="text-white/80 text-xs">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(video.product?.price || 0)}
              </p>
            </div>
            <Link to={`/p/${video.product?.slug}`}>
              <Button size="sm" className="bg-white text-black hover:bg-white/90 gap-1 text-xs px-2 h-8">
                Ver <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VideoShopping() {
  const { data: videos, isLoading } = useProductVideos();
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (isLoading || !videos || videos.length === 0) return null;

  return (
    <>
      {/* Floating Bubble for Reels */}
      <div className="fixed bottom-24 right-4 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 shadow-lg transition-transform hover:scale-110 active:scale-95 overflow-hidden border-2 border-white"
        >
          <div className="absolute inset-0 opacity-40">
             <video 
              src={videos[0].video_url} 
              className="h-full w-full object-cover" 
              autoPlay 
              muted 
              loop 
              playsInline 
            />
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <Play className="h-6 w-6 text-white fill-white animate-pulse" />
            <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Shop</span>
          </div>
        </button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md p-0 bg-black border-none h-[90vh] sm:h-[80vh] overflow-hidden rounded-2xl">
          <div className="relative h-full w-full overflow-y-auto snap-y snap-mandatory scrollbar-none">
            {videos.map((video, index) => (
              <div key={video.id} className="h-full w-full snap-start shrink-0">
                <VideoPlayer 
                  video={video} 
                  isActive={isOpen && currentIndex === index} 
                  onClose={() => setIsOpen(false)}
                />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
