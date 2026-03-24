import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLojaContext } from "./LojaLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function LojaCheckout() {
  const { cart, settings } = useLojaContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const handleSubmit = async (viaWhatsApp = false) => {
    if (!name.trim()) return toast.error("Informe seu nome");
    if (!phone.trim()) return toast.error("Informe seu telefone");
    if (cart.items.length === 0) return toast.error("Carrinho vazio");

    setLoading(true);
    try {
      // Find the store owner user_id from settings
      const userId = settings?.user_id;
      if (!userId) throw new Error("Loja não configurada");

      // Create order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: userId,
          customer_name: name.trim(),
          customer_email: email.trim() || null,
          customer_phone: phone.trim(),
          customer_address: address.trim() || null,
          notes: notes.trim() || null,
          total: cart.total,
          whatsapp_order: viaWhatsApp,
          status: "pendente",
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      // Create order items
      const items = cart.items.map((i) => ({
        order_id: order.id,
        product_id: i.id,
        product_name: i.name,
        product_image: i.image_url,
        quantity: i.quantity,
        unit_price: i.price,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      // Status history
      await supabase.from("order_status_history").insert({ order_id: order.id, status: "pendente" });

      if (viaWhatsApp && settings?.store_whatsapp) {
        const msg = cart.items.map((i) => `${i.quantity}x ${i.name} - ${formatPrice(i.price * i.quantity)}`).join("\n");
        const text = `🛒 *Novo Pedido #${order.id.slice(0, 8)}*\n\n*Cliente:* ${name}\n*Telefone:* ${phone}\n${address ? `*Endereço:* ${address}\n` : ""}${notes ? `*Obs:* ${notes}\n` : ""}\n*Itens:*\n${msg}\n\n*Total: ${formatPrice(cart.total)}*`;
        window.open(`https://wa.me/${settings.store_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
      }

      cart.clearCart();
      setSuccess(true);
    } catch (err: any) {
      toast.error("Erro ao criar pedido: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <h1 className="text-2xl font-bold mt-4">Pedido Realizado!</h1>
        <p className="text-gray-500 mt-2">Seu pedido foi enviado com sucesso. Acompanhe pelo WhatsApp ou email.</p>
        <Button className="mt-6 bg-black text-white hover:bg-gray-800" onClick={() => navigate("/loja")}>Voltar à Loja</Button>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Carrinho vazio</h1>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/loja")}>Ver Produtos</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Finalizar Compra</h1>

      <div className="grid gap-6">
        {/* Items summary */}
        <Card>
          <CardHeader><CardTitle className="text-base">Resumo do Pedido</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.name}</span>
                <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatPrice(cart.total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Customer info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Seus Dados</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" maxLength={20} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label>Endereço de Entrega</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro, cidade, CEP" maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alguma observação sobre o pedido?" maxLength={500} />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button className="w-full bg-black text-white hover:bg-gray-800 h-12 text-base" onClick={() => handleSubmit(false)} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Finalizar Pedido
          </Button>
          {settings?.sell_via_whatsapp && settings?.store_whatsapp && (
            <Button
              variant="outline"
              className="w-full border-green-500 text-green-600 hover:bg-green-50 h-12 text-base"
              onClick={() => handleSubmit(true)}
              disabled={loading}
            >
              <MessageCircle className="mr-2 h-5 w-5" /> Finalizar via WhatsApp
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
