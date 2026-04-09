import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePublicStoreBySlug } from "@/hooks/usePublicStore";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LojaPagina() {
  const { slug, pageSlug } = useParams();
  const { data: store } = usePublicStoreBySlug(slug);

  const { data: page, isLoading } = useQuery({
    queryKey: ["store_page", store?.user_id, pageSlug],
    enabled: !!store?.user_id && !!pageSlug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_pages")
        .select("*")
        .eq("user_id", store!.user_id)
        .eq("slug", pageSlug)
        .eq("published", true)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold mb-4">Página não encontrada</h1>
        <p className="text-muted-foreground mb-8">A página que você está procurando não existe ou não está disponível.</p>
        <Button asChild>
          <Link to={`/loja/${slug}`}>Voltar para a Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link 
        to={`/loja/${slug}`} 
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ChevronLeft className="mr-1 h-4 w-4" /> Voltar para a Home
      </Link>
      
      <article className="prose prose-sm sm:prose-base lg:prose-lg dark:prose-invert max-w-none">
        <h1 className="text-3xl font-bold mb-8">{page.title}</h1>
        <div className="whitespace-pre-wrap text-foreground">
          {page.content}
        </div>
      </article>
    </div>
  );
}
