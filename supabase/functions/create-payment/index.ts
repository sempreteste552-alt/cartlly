import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  order_id: string;
  method: "pix" | "credit_card" | "boleto";
  card_token?: string;
  installments?: number;
  store_user_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: PaymentRequest = await req.json();
    const { order_id, method, card_token, installments, store_user_id } = body;

    if (!order_id || !method || !store_user_id) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: order_id, method, store_user_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get store settings with secret key
    const { data: settings, error: settingsErr } = await supabase
      .from("store_settings")
      .select("*")
      .eq("user_id", store_user_id)
      .single();

    if (settingsErr || !settings) {
      return new Response(JSON.stringify({ error: "Configurações da loja não encontradas" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gateway = settings.payment_gateway;
    const secretKey = settings.gateway_secret_key;
    const environment = settings.gateway_environment;

    if (!gateway || !secretKey) {
      return new Response(JSON.stringify({ error: "Gateway de pagamento não configurado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get order details
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let paymentResult: any;

    if (gateway === "mercadopago") {
      paymentResult = await createMercadoPagoPayment(order, method, secretKey, environment, card_token, installments);
    } else if (gateway === "pagbank") {
      paymentResult = await createPagBankPayment(order, method, secretKey, environment);
    } else {
      return new Response(JSON.stringify({ error: "Gateway não suportado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save payment record
    const { data: payment, error: paymentErr } = await supabase
      .from("payments")
      .insert({
        order_id,
        user_id: store_user_id,
        gateway,
        gateway_payment_id: paymentResult.gateway_payment_id,
        method,
        status: paymentResult.status,
        amount: order.total,
        pix_qr_code: paymentResult.pix_qr_code || null,
        pix_qr_code_base64: paymentResult.pix_qr_code_base64 || null,
        pix_expiration: paymentResult.pix_expiration || null,
        boleto_url: paymentResult.boleto_url || null,
        boleto_barcode: paymentResult.boleto_barcode || null,
        boleto_expiration: paymentResult.boleto_expiration || null,
        card_last_four: paymentResult.card_last_four || null,
        card_brand: paymentResult.card_brand || null,
        raw_response: paymentResult.raw,
      })
      .select()
      .single();

    if (paymentErr) {
      console.error("Error saving payment:", paymentErr);
      return new Response(JSON.stringify({ error: "Erro ao salvar pagamento" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update order status
    if (paymentResult.status === "approved") {
      await supabase.from("orders").update({ status: "processando" }).eq("id", order_id);
      await supabase.from("order_status_history").insert({ order_id, status: "processando" });
    }

    return new Response(JSON.stringify({ payment, paymentResult }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Payment error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ===================== MERCADO PAGO =====================

async function createMercadoPagoPayment(
  order: any, method: string, accessToken: string, environment: string,
  cardToken?: string, installments?: number
) {
  const baseUrl = "https://api.mercadopago.com/v1";

  const paymentData: any = {
    transaction_amount: Number(order.total),
    description: `Pedido #${order.id.slice(0, 8)}`,
    external_reference: order.id,
    payer: {
      email: order.customer_email || "cliente@email.com",
      first_name: order.customer_name?.split(" ")[0] || "Cliente",
      last_name: order.customer_name?.split(" ").slice(1).join(" ") || "",
    },
  };

  if (method === "pix") {
    paymentData.payment_method_id = "pix";
  } else if (method === "credit_card") {
    if (!cardToken) throw new Error("Token do cartão é obrigatório");
    paymentData.token = cardToken;
    paymentData.installments = installments || 1;
    paymentData.payment_method_id = "visa"; // Will be detected by MP
  } else if (method === "boleto") {
    paymentData.payment_method_id = "bolbradesco";
  }

  const response = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(paymentData),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("MP Error:", JSON.stringify(data));
    throw new Error(data.message || `Erro Mercado Pago: ${response.status}`);
  }

  const result: any = {
    gateway_payment_id: String(data.id),
    status: mapMPStatus(data.status),
    raw: data,
  };

  if (method === "pix" && data.point_of_interaction?.transaction_data) {
    result.pix_qr_code = data.point_of_interaction.transaction_data.qr_code;
    result.pix_qr_code_base64 = data.point_of_interaction.transaction_data.qr_code_base64;
    result.pix_expiration = data.date_of_expiration;
  }

  if (method === "boleto" && data.transaction_details) {
    result.boleto_url = data.transaction_details.external_resource_url;
    result.boleto_barcode = data.barcode?.content;
    result.boleto_expiration = data.date_of_expiration;
  }

  if (method === "credit_card" && data.card) {
    result.card_last_four = data.card.last_four_digits;
    result.card_brand = data.payment_method_id;
  }

  return result;
}

function mapMPStatus(status: string): string {
  const map: Record<string, string> = {
    approved: "approved",
    pending: "pending",
    authorized: "pending",
    in_process: "pending",
    in_mediation: "pending",
    rejected: "rejected",
    cancelled: "cancelled",
    refunded: "refunded",
  };
  return map[status] || "pending";
}

// ===================== PAGBANK =====================

async function createPagBankPayment(
  order: any, method: string, token: string, environment: string
) {
  const baseUrl = environment === "production"
    ? "https://api.pagseguro.com"
    : "https://sandbox.api.pagseguro.com";

  const orderData: any = {
    reference_id: order.id,
    customer: {
      name: order.customer_name || "Cliente",
      email: order.customer_email || "cliente@email.com",
      tax_id: "00000000000", // CPF placeholder
      phones: order.customer_phone ? [{
        country: "55",
        area: order.customer_phone.replace(/\D/g, "").slice(0, 2),
        number: order.customer_phone.replace(/\D/g, "").slice(2),
        type: "MOBILE",
      }] : [],
    },
    items: [{
      reference_id: order.id,
      name: `Pedido #${order.id.slice(0, 8)}`,
      quantity: 1,
      unit_amount: Math.round(Number(order.total) * 100),
    }],
    charges: [] as any[],
  };

  if (method === "pix") {
    orderData.qr_codes = [{
      amount: { value: Math.round(Number(order.total) * 100) },
      expiration_date: new Date(Date.now() + 3600 * 1000).toISOString(),
    }];
  } else if (method === "boleto") {
    orderData.charges.push({
      reference_id: crypto.randomUUID(),
      description: `Pedido #${order.id.slice(0, 8)}`,
      amount: { value: Math.round(Number(order.total) * 100), currency: "BRL" },
      payment_method: {
        type: "BOLETO",
        boleto: {
          due_date: new Date(Date.now() + 3 * 86400 * 1000).toISOString().split("T")[0],
          instruction_lines: { line_1: "Pagamento pedido", line_2: "" },
          holder: {
            name: order.customer_name || "Cliente",
            tax_id: "00000000000",
            email: order.customer_email || "cliente@email.com",
            address: {
              street: "Rua",
              number: "0",
              locality: "Centro",
              city: "São Paulo",
              region_code: "SP",
              country: "BRA",
              postal_code: "01000000",
            },
          },
        },
      },
    });
  } else if (method === "credit_card") {
    // For PagBank, credit card needs encrypted card data from frontend
    orderData.charges.push({
      reference_id: crypto.randomUUID(),
      description: `Pedido #${order.id.slice(0, 8)}`,
      amount: { value: Math.round(Number(order.total) * 100), currency: "BRL" },
      payment_method: {
        type: "CREDIT_CARD",
        installments: 1,
        capture: true,
        card: {
          encrypted: "placeholder", // Would come from frontend SDK
        },
        holder: {
          name: order.customer_name || "Cliente",
          tax_id: "00000000000",
        },
      },
    });
  }

  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(orderData),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("PagBank Error:", JSON.stringify(data));
    throw new Error(data.error_messages?.[0]?.description || `Erro PagBank: ${response.status}`);
  }

  const result: any = {
    gateway_payment_id: data.id,
    status: "pending",
    raw: data,
  };

  // PIX
  if (method === "pix" && data.qr_codes?.[0]) {
    const qr = data.qr_codes[0];
    result.pix_qr_code = qr.text;
    result.pix_qr_code_base64 = qr.links?.find((l: any) => l.media === "image/png")?.href;
    result.pix_expiration = qr.expiration_date;
  }

  // Boleto
  if (method === "boleto" && data.charges?.[0]) {
    const charge = data.charges[0];
    const boletoLink = charge.links?.find((l: any) => l.rel === "BOLETO.PDF");
    result.boleto_url = boletoLink?.href;
    result.boleto_barcode = charge.payment_method?.boleto?.barcode;
    result.boleto_expiration = charge.payment_method?.boleto?.due_date;
  }

  // Credit card
  if (method === "credit_card" && data.charges?.[0]) {
    const charge = data.charges[0];
    result.status = charge.status === "PAID" ? "approved" : "pending";
    result.card_last_four = charge.payment_method?.card?.last_digits;
    result.card_brand = charge.payment_method?.card?.brand;
  }

  return result;
}
