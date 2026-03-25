import { useState } from "react";
import { useProductReviews, useAverageRating, useCreateReview } from "@/hooks/useProductReviews";
import { StarRating } from "./StarRating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { MessageSquare, User } from "lucide-react";

interface ProductReviewsProps {
  productId: string;
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const { data: reviews, isLoading } = useProductReviews(productId);
  const { average, count } = useAverageRating(reviews);
  const createReview = useCreateReview();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return toast.error("Informe seu nome");
    if (rating === 0) return toast.error("Selecione uma avaliação");
    if (name.length > 100 || comment.length > 1000) return toast.error("Texto muito longo");

    createReview.mutate(
      {
        product_id: productId,
        customer_name: name.trim(),
        customer_email: email.trim() || undefined,
        rating,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Avaliação enviada!");
          setShowForm(false);
          setName("");
          setEmail("");
          setRating(0);
          setComment("");
        },
        onError: () => toast.error("Erro ao enviar avaliação"),
      }
    );
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="mt-10">
      <Separator />
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Avaliações</h2>
            {count > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <StarRating rating={Math.round(average)} size={18} />
                <span className="text-sm text-gray-500">
                  {average.toFixed(1)} ({count} {count === 1 ? "avaliação" : "avaliações"})
                </span>
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
            <MessageSquare className="h-4 w-4 mr-1" /> Avaliar
          </Button>
        </div>

        {showForm && (
          <div className="border rounded-lg p-4 mb-6 space-y-3 bg-gray-50">
            <p className="font-medium text-sm">Deixe sua avaliação</p>
            <StarRating rating={rating} interactive onChange={setRating} size={28} />
            <Input placeholder="Seu nome *" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            <Input placeholder="E-mail (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
            <Textarea placeholder="Comentário (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} />
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={createReview.isPending} className="bg-black text-white hover:bg-gray-800">
                {createReview.isPending ? "Enviando..." : "Enviar"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-400">Carregando avaliações...</p>
        ) : !reviews || reviews.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma avaliação ainda. Seja o primeiro!</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-sm">{r.customer_name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                </div>
                <StarRating rating={r.rating} size={16} />
                {r.comment && <p className="text-sm text-gray-600 mt-2">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
