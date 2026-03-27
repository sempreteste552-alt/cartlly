import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PaymentRequest {
  order_id: string;
  method: "pix" | "credit_card" | "boleto";
  card_token?: string;
  installments?: number;
  store_user_id: string;
  payer_cpf?: string;
  payer_first_name?: string;
  payer_last_name?: string;
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

    const body = await req.json();

    // ==================== TEST MODE ====================
    if (body.test === true) {
      const { gateway, store_user_id: testStoreUserId } = body;
      if (!gateway || !testStoreUserId) {
        return json({ test_ok: false, error: "Gateway e store_user_id são obrigatórios para teste" }, 400);
      }

      const { data: testSettings, error: testErr } = await supabase
        .from("store_settings")
        .select("payment_gateway, gateway_public_key, gateway_secret_key, gateway_environment, store_name")
        .eq("user_id", testStoreUserId)
        .single();

      if (testErr || !testSettings) {
        return json({ test_ok: false, error: "Configurações da loja não encontradas. Salve o gateway primeiro." }, 404);
      }

      if (!testSettings.gateway_secret_key) {
        return json({ test_ok: false, error: "Chave secreta / Access Token não configurada. Salve o gateway primeiro." }, 400);
      }

      const { data: ownerProfile } = await supabase.from("profiles").select("display_name").eq("user_id", testStoreUserId).single();
      const { data: authData } = await supabase.auth.admin.getUserById(testStoreUserId);
      const ownerEmail = authData?.user?.email || "";
      const ownerName = ownerProfile?.display_name || testSettings.store_name || "Proprietário";

      try {
        if (gateway === "mercadopago") {
          // Fetch the actual MP account owner info via /users/me
          const mpUserRes = await fetch("https://api.mercadopago.com/users/me", {
            headers: { Authorization: `Bearer ${testSettings.gateway_secret_key}` },
          });
          if (mpUserRes.ok) {
            const mpUser = await mpUserRes.json();
            const mpOwnerName = [mpUser.first_name, mpUser.last_name].filter(Boolean).join(" ") || mpUser.nickname || "Proprietário MP";
            const mpOwnerEmail = mpUser.email || "";
            const mpSiteId = mpUser.site_id || "";
            return json({
              test_ok: true,
              message: "✅ Mercado Pago conectado com sucesso!",
              owner_name: mpOwnerName,
              owner_email: mpOwnerEmail,
              store_name: mpUser.nickname || testSettings.store_name,
              mp_site: mpSiteId,
            });
          }
          const mpBody = await mpUserRes.text();
          let mpError = `Erro Mercado Pago (${mpUserRes.status})`;
          try {
            const mpJson = JSON.parse(mpBody);
            mpError = mpJson.message || mpError;
          } catch {}
          return json({ test_ok: false, error: `❌ ${mpError}. Verifique se o Access Token está correto no painel do Mercado Pago.` });
        }

        if (gateway === "pagbank") {
          const env = testSettings.gateway_environment === "production" ? "https://api.pagseguro.com" : "https://sandbox.api.pagseguro.com";
          const pbRes = await fetch(`${env}/public-keys`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${testSettings.gateway_secret_key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ type: "card" }),
          });
          if (pbRes.ok || pbRes.status === 409) {
            return json({ test_ok: true, message: "✅ PagBank conectado com sucesso!", owner_name: ownerName, owner_email: ownerEmail, store_name: testSettings.store_name });
          }
          const pbBody = await pbRes.text();
          let pbError = `Erro PagBank (${pbRes.status})`;
          try {
            const pbJson = JSON.parse(pbBody);
            pbError = pbJson.error_messages?.[0]?.description || pbJson.message || pbError;
          } catch {}
          return json({ test_ok: false, error: `❌ ${pbError}. Verifique seu Token no painel do PagBank.` });
        }

        if (gateway === "amplopay") {
          // Amplopay - test with a simple balance check or config validation
          return json({ test_ok: true, message: "✅ Amplopay configurado. O teste real ocorre ao processar pagamentos.", owner_name: ownerName, owner_email: ownerEmail, store_name: testSettings.store_name });
        }

        return json({ test_ok: true, message: `Gateway ${gateway} configurado. Teste real disponível ao processar pagamentos.`, owner_name: ownerName, owner_email: ownerEmail, store_name: testSettings.store_name });
      } catch (testError: any) {
        return json({ test_ok: false, error: "Erro de conexão com o gateway: " + testError.message });
      }
    }

    // ==================== PAYMENT PROCESSING ====================
    const { order_id, method, card_token, installments, store_user_id, payer_cpf } = body as PaymentRequest;

    if (!order_id || !method || !store_user_id) {
      return json({ error: "Campos obrigatórios: order_id, method, store_user_id" }, 400);
    }

    const { data: settings, error: settingsErr } = await supabase
      .from("store_settings")
      .select("*")
      .eq("user_id", store_user_id)
      .single();

    if (settingsErr || !settings) {
      return json({ error: "Configurações da loja não encontradas. O proprietário deve configurar o gateway de pagamento." }, 404);
    }

    const gateway = settings.payment_gateway;
    const secretKey = settings.gateway_secret_key;
    const publicKey = settings.gateway_public_key;
    const environment = settings.gateway_environment;

    if (!gateway) {
      return json({ error: "Nenhum gateway de pagamento configurado nesta loja. Contacte o proprietário." }, 400);
    }

    if (!secretKey) {
      return json({ error: `O gateway ${gatewayLabel(gateway)} está configurado mas a chave secreta está vazia. O proprietário deve revisar as configurações.` }, 400);
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return json({ error: "Pedido não encontrado" }, 404);
    }

    let paymentResult: any;

    try {
      if (gateway === "mercadopago") {
        paymentResult = await createMercadoPagoPayment(order, method, secretKey, environment, card_token, installments, payer_cpf);
      } else if (gateway === "pagbank") {
        paymentResult = await createPagBankPayment(order, method, secretKey, environment);
      } else if (gateway === "amplopay") {
        paymentResult = await createAmplopayPayment(order, method, secretKey, publicKey, environment);
      } else {
        return json({ error: `Gateway "${gateway}" não é suportado para pagamentos. Gateways disponíveis: Mercado Pago, PagBank, Amplopay.` }, 400);
      }
    } catch (gwErr: any) {
      console.error(`Gateway ${gateway} error:`, gwErr.message);
      return json({
        error: `Erro no ${gatewayLabel(gateway)}: ${gwErr.message}. Verifique as credenciais e tente novamente. Se o problema persistir, entre em contato com o suporte do ${gatewayLabel(gateway)}.`,
        gateway_error: true,
      }, 502);
    }

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
      return json({ error: "Pagamento processado no gateway mas houve erro ao salvar no banco. Contacte o suporte." }, 500);
    }

    if (paymentResult.status === "approved") {
      await supabase.from("orders").update({ status: "processando" }).eq("id", order_id);
      await supabase.from("order_status_history").insert({ order_id, status: "processando" });
    }

    return json({ payment, paymentResult });
  } catch (error: any) {
    console.error("Payment error:", error);
    return json({ error: error.message || "Erro interno no servidor de pagamentos" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function gatewayLabel(gw: string): string {
  const labels: Record<string, string> = {
    mercadopago: "Mercado Pago",
    pagbank: "PagBank",
    amplopay: "Amplopay",
  };
  return labels[gw] || gw;
}

// ===================== MERCADO PAGO =====================

async function createMercadoPagoPayment(
  order: any,
  method: string,
  accessToken: string,
  environment: string,
  cardToken?: string,
  installments?: number
) {
  const baseUrl = "https://api.mercadopago.com/v1";

  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?gateway=mercadopago`;

  const paymentData: any = {
    transaction_amount: Number(order.total),
    description: `Pedido #${order.id.slice(0, 8)}`,
    external_reference: order.id,
    notification_url: webhookUrl,
    payer: {
      email: order.customer_email || "cliente@email.com",
      first_name: order.customer_name?.split(" ")[0] || "Cliente",
      last_name: order.customer_name?.split(" ").slice(1).join(" ") || "",
    },
  };

  if (method === "pix") {
    paymentData.payment_method_id = "pix";
  } else if (method === "credit_card") {
    if (!cardToken) throw new Error("Token do cartão é obrigatório para pagamento com cartão de crédito");
    paymentData.token = cardToken;
    paymentData.installments = installments || 1;
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
    if (data.message?.includes("access_token")) {
      throw new Error("Access Token do Mercado Pago inválido ou expirado. Gere um novo token no painel do Mercado Pago → Credenciais.");
    }
    throw new Error(data.message || data.cause?.[0]?.description || `Erro HTTP ${response.status} no Mercado Pago`);
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
  order: any,
  method: string,
  token: string,
  environment: string
) {
  const baseUrl =
    environment === "production"
      ? "https://api.pagseguro.com"
      : "https://sandbox.api.pagseguro.com";

  const orderData: any = {
    reference_id: order.id,
    customer: {
      name: order.customer_name || "Cliente",
      email: order.customer_email || "cliente@email.com",
      tax_id: "00000000000",
      phones: order.customer_phone
        ? [
            {
              country: "55",
              area: order.customer_phone.replace(/\D/g, "").slice(0, 2),
              number: order.customer_phone.replace(/\D/g, "").slice(2),
              type: "MOBILE",
            },
          ]
        : [],
    },
    items: [
      {
        reference_id: order.id,
        name: `Pedido #${order.id.slice(0, 8)}`,
        quantity: 1,
        unit_amount: Math.round(Number(order.total) * 100),
      },
    ],
    charges: [] as any[],
  };

  if (method === "pix") {
    orderData.qr_codes = [
      {
        amount: { value: Math.round(Number(order.total) * 100) },
        expiration_date: new Date(Date.now() + 3600 * 1000).toISOString(),
      },
    ];
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
    orderData.charges.push({
      reference_id: crypto.randomUUID(),
      description: `Pedido #${order.id.slice(0, 8)}`,
      amount: { value: Math.round(Number(order.total) * 100), currency: "BRL" },
      payment_method: {
        type: "CREDIT_CARD",
        installments: 1,
        capture: true,
        card: { encrypted: "placeholder" },
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
    if (response.status === 401) {
      throw new Error("Token do PagBank inválido ou expirado. Gere um novo token no painel do PagBank.");
    }
    throw new Error(data.error_messages?.[0]?.description || `Erro HTTP ${response.status} no PagBank`);
  }

  const result: any = {
    gateway_payment_id: data.id,
    status: "pending",
    raw: data,
  };

  if (method === "pix" && data.qr_codes?.[0]) {
    const qr = data.qr_codes[0];
    result.pix_qr_code = qr.text;
    result.pix_qr_code_base64 = qr.links?.find((l: any) => l.media === "image/png")?.href;
    result.pix_expiration = qr.expiration_date;
  }

  if (method === "boleto" && data.charges?.[0]) {
    const charge = data.charges[0];
    const boletoLink = charge.links?.find((l: any) => l.rel === "BOLETO.PDF");
    result.boleto_url = boletoLink?.href;
    result.boleto_barcode = charge.payment_method?.boleto?.barcode;
    result.boleto_expiration = charge.payment_method?.boleto?.due_date;
  }

  if (method === "credit_card" && data.charges?.[0]) {
    const charge = data.charges[0];
    result.status = charge.status === "PAID" ? "approved" : "pending";
    result.card_last_four = charge.payment_method?.card?.last_digits;
    result.card_brand = charge.payment_method?.card?.brand;
  }

  return result;
}

// ===================== AMPLOPAY =====================

async function createAmplopayPayment(
  order: any,
  method: string,
  secretKey: string,
  publicKey: string | null,
  environment: string
) {
  const BASE_URL = "https://app.amplopay.com/api/v1";

  const clientData = {
    name: order.customer_name || "Cliente",
    email: order.customer_email || "cliente@email.com",
    phone: order.customer_phone || "(00) 0 0000-0000",
    document: "00000000000",
  };

  const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?gateway=amplopay`;
  const identifier = `order_${order.id}_${Date.now()}`;

  let endpoint = "";
  let requestBody: any = {};

  if (method === "pix") {
    endpoint = `${BASE_URL}/gateway/pix/receive`;
    requestBody = {
      identifier,
      amount: Number(order.total),
      product: {
        id: order.id,
        name: `Pedido #${order.id.slice(0, 8)}`,
        quantity: 1,
        price: Number(order.total),
      },
      client: clientData,
      callbackUrl,
    };
  } else if (method === "boleto") {
    endpoint = `${BASE_URL}/gateway/boleto/receive`;
    requestBody = {
      identifier,
      amount: Number(order.total),
      product: {
        id: order.id,
        name: `Pedido #${order.id.slice(0, 8)}`,
        quantity: 1,
        price: Number(order.total),
      },
      dueDate: new Date(Date.now() + 3 * 86400 * 1000).toISOString().split("T")[0],
      client: clientData,
      callbackUrl,
    };
  } else {
    throw new Error("Amplopay suporta apenas PIX e Boleto. Cartão de crédito não disponível.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-secret-key": secretKey,
  };
  if (publicKey) headers["x-public-key"] = publicKey;

  console.log("Amplopay request:", endpoint);

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log("Amplopay response:", response.status, responseText);

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Resposta inválida do Amplopay (HTTP ${response.status}): ${responseText.slice(0, 200)}`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Chaves do Amplopay inválidas. Verifique as chaves pública e secreta no painel da Amplopay.");
    }
    throw new Error(data.message || data.error || `Erro HTTP ${response.status} no Amplopay`);
  }

  const result: any = {
    gateway_payment_id: data.transactionId || data.id || identifier,
    status: "pending",
    raw: data,
  };

  if (method === "pix" && data.pix) {
    result.pix_qr_code = data.pix.code || data.pix.qrCode;
    result.pix_qr_code_base64 = data.pix.base64 || data.pix.qrCodeBase64 || data.pix.image;
    result.pix_expiration = data.pix.expiration || new Date(Date.now() + 1800 * 1000).toISOString();
  }

  if (method === "boleto" && data.boleto) {
    result.boleto_url = data.boleto.url || data.boleto.bankSlipUrl;
    result.boleto_barcode = data.boleto.barcode || data.boleto.digitableLine;
    result.boleto_expiration = data.boleto.dueDate;
  }

  return result;
}
