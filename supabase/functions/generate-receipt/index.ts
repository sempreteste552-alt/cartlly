import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), { status: 400, headers: corsHeaders });
    }

    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: corsHeaders });
    }

    // Fetch items
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    // Fetch store settings
    const { data: store } = await supabase
      .from("store_settings")
      .select("store_name, store_phone, store_address, store_whatsapp, logo_url, primary_color")
      .eq("user_id", order.user_id)
      .single();

    const storeName = store?.store_name || "Loja";
    const primaryColor = store?.primary_color || "#6d28d9";
    const formatPrice = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
    const orderDate = new Date(order.created_at).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    const itemsHtml = (items || []).map((item: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:left;">${escapeHtml(item.product_name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatPrice(item.unit_price)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatPrice(item.unit_price * item.quantity)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Comprovante #${orderId.slice(0, 8)}</title></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f9f9f9;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
  
  <!-- Header -->
  <div style="background:${primaryColor};color:#fff;padding:24px;text-align:center;">
    ${store?.logo_url ? `<img src="${store.logo_url}" alt="${storeName}" style="max-height:48px;margin-bottom:8px;" />` : ""}
    <h1 style="margin:0;font-size:22px;">${escapeHtml(storeName)}</h1>
    <p style="margin:4px 0 0;opacity:0.9;font-size:13px;">Comprovante de Pedido</p>
  </div>

  <div style="padding:24px;">
    <!-- Order info -->
    <div style="display:flex;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:8px;">
      <div>
        <p style="margin:0;font-size:12px;color:#888;">Pedido</p>
        <p style="margin:0;font-weight:bold;font-size:16px;">#${orderId.slice(0, 8)}</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:12px;color:#888;">Data</p>
        <p style="margin:0;font-size:14px;">${orderDate}</p>
      </div>
    </div>

    <!-- Customer -->
    <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Cliente</p>
      <p style="margin:0;font-weight:bold;">${escapeHtml(order.customer_name)}</p>
      ${order.customer_email ? `<p style="margin:2px 0 0;font-size:13px;color:#666;">${escapeHtml(order.customer_email)}</p>` : ""}
      ${order.customer_phone ? `<p style="margin:2px 0 0;font-size:13px;color:#666;">${escapeHtml(order.customer_phone)}</p>` : ""}
      ${order.customer_address ? `<p style="margin:4px 0 0;font-size:13px;color:#666;">${escapeHtml(order.customer_address)}</p>` : ""}
    </div>

    <!-- Items -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="background:#f0f0f0;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#666;">Produto</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#666;">Qtd</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#666;">Unit.</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#666;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    <div style="border-top:2px solid #eee;padding-top:12px;">
      ${order.shipping_cost > 0 ? `
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;">
        <span style="color:#666;">Frete${order.shipping_method ? ` (${escapeHtml(order.shipping_method)})` : ""}</span>
        <span>${formatPrice(order.shipping_cost)}</span>
      </div>` : ""}
      ${order.discount_amount > 0 ? `
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;color:green;">
        <span>Desconto${order.coupon_code ? ` (${escapeHtml(order.coupon_code)})` : ""}</span>
        <span>-${formatPrice(order.discount_amount)}</span>
      </div>` : ""}
      <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:bold;margin-top:8px;color:${primaryColor};">
        <span>Total</span>
        <span>${formatPrice(order.total)}</span>
      </div>
    </div>

    ${order.notes ? `
    <div style="margin-top:16px;background:#fffbeb;border-radius:8px;padding:12px;">
      <p style="margin:0;font-size:12px;color:#888;">Observações</p>
      <p style="margin:4px 0 0;font-size:13px;">${escapeHtml(order.notes)}</p>
    </div>` : ""}
  </div>

  <!-- Footer -->
  <div style="background:#f8f8f8;padding:16px;text-align:center;font-size:12px;color:#888;">
    ${store?.store_phone ? `<p style="margin:0;">📞 ${escapeHtml(store.store_phone)}</p>` : ""}
    ${store?.store_address ? `<p style="margin:2px 0 0;">📍 ${escapeHtml(store.store_address)}</p>` : ""}
    <p style="margin:8px 0 0;">Obrigado pela preferência! 💜</p>
  </div>
</div>
</body>
</html>`;

    return new Response(JSON.stringify({ html, orderId: order.id, customerEmail: order.customer_email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Receipt error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
