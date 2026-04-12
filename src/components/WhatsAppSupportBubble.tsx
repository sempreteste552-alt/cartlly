import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import whatsappIcon from "@/assets/whatsapp-support.png";

export function WhatsAppSupportBubble() {
  const { data: number } = useQuery({
    queryKey: ["platform_support_whatsapp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "support_whatsapp_number")
        .maybeSingle();
      const val = (data?.value as any)?.value;
      return typeof val === "string" && val.length >= 10 ? val.replace(/\D/g, "") : null;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!number) return null;

  const url = `https://wa.me/${number}?text=${encodeURIComponent("Olá! Preciso de suporte.")}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-[49] group"
      title="Suporte via WhatsApp"
    >
      <div className="relative">
        <img
          src={whatsappIcon}
          alt="WhatsApp Suporte"
          className="h-12 w-12 rounded-xl shadow-lg transition-transform duration-200 group-hover:scale-110 group-hover:shadow-xl"
        />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 items-center justify-center text-[8px] text-white font-bold">!</span>
        </span>
      </div>
    </a>
  );
}
