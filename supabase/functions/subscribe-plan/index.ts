import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    // ==================== CHECK GATEWAY ====================
    if (body.action === "check_gateway") {
      const { data: settings } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", [
          "plan_gateway",
          "plan_gateway_public_key",
          "plan_gateway_secret_key",
          "mercadopago_global_key",
          "mercadopago_public_key",
          "pagbank_global_key",
          "pagbank_public_key",
          "pagbank_environment",
          "amplopay_public_key",
          "amplopay_secret_key",
        ]);

      const cfg: Record<string, string> = {};
      settings?.forEach((s: any) => {
        cfg[s.key] = s.value?.value ?? s.value ?? "";
      });

      // Asaas key comes from edge env (preferred). Override default if present.
      const asaasKey = Deno.env.get("ASAAS_API_KEY") || "";
      if (asaasKey) cfg.asaas_api_key = asaasKey;

      // Determine active gateway. Prefer asaas if configured.
      const gateway = cfg.plan_gateway || detectGateway(cfg);
      const hasKeys = !!getGatewayKeys(gateway, cfg).secretKey;

      return json({
        gateway: hasKeys ? gateway : null,
        methods: hasKeys ? getAvailableMethods(gateway) : [],
      });
    }

    // ==================== PROCESS PAYMENT ====================
    const { user_id, plan_id, payment_method, document, phone, card, card_token, installments, device_id, payment_method_id, issuer_id, payer_name, payer_email } = body;

    if (!user_id || !plan_id) {
      return json({ error: "Dados incompletos" }, 400);
    }

    // Get plan
    const { data: plan, error: planErr } = await supabase
      .from("tenant_plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planErr || !plan) return json({ error: "Plano não encontrado" }, 404);
    if (plan.price <= 0) return json({ error: "Plano gratuito não requer pagamento" }, 400);

    // Get platform gateway settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "plan_gateway",
        "mercadopago_global_key",
        "mercadopago_public_key",
        "pagbank_global_key",
        "pagbank_public_key",
        "pagbank_environment",
        "amplopay_public_key",
        "amplopay_secret_key",
      ]);

    const cfg: Record<string, string> = {};
    settings?.forEach((s: any) => {
      cfg[s.key] = s.value?.value ?? s.value ?? "";
    });

    // Asaas API key from env (preferred path)
    const asaasKey = Deno.env.get("ASAAS_API_KEY") || "";
    if (asaasKey) cfg.asaas_api_key = asaasKey;

    const gateway = cfg.plan_gateway || detectGateway(cfg);
    const keys = getGatewayKeys(gateway, cfg);

    if (!keys.secretKey) {
      return json({ error: "Gateway de pagamento não configurado pelo administrador. Entre em contato via WhatsApp." }, 400);
    }

    // Get tenant info
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", user_id).single();
    const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
    const tenantEmail = payer_email || authUser?.user?.email || `tenant-${user_id}@cartlly.com`;
    const tenantName = payer_name || profile?.display_name || "Tenant";

    const method = payment_method || "PIX";
    let result: any;

    try {
      if (gateway === "mercadopago") {
        result = await processMercadoPago(keys.secretKey, plan, method, tenantEmail, tenantName, document, card_token, installments, user_id, device_id, payment_method_id, issuer_id);
      } else if (gateway === "pagbank") {
        result = await processPagBank(keys.secretKey, cfg.pagbank_environment || "sandbox", plan, method, tenantEmail, tenantName, document, phone, card_token, user_id);
      } else if (gateway === "amplopay") {
        result = await processAmplopay(keys.secretKey, keys.publicKey, plan, method, tenantEmail, tenantName, document, phone, user_id);
      } else if (gateway === "asaas") {
        result = await processAsaas(keys.secretKey, plan, method, tenantEmail, tenantName, document, phone, card_token, card, installments, user_id);
      } else {
        return json({ error: `Gateway "${gateway}" não suportado` }, 400);
      }
    } catch (gwErr: any) {
      console.error(`Subscribe gateway ${gateway} error:`, gwErr.message);
      return json({ error: gwErr.message, gateway_error: true }, 502);
    }

    // If card payment approved immediately, activate subscription
    if (result.status === "approved") {
      await activateSubscription(supabase, user_id, plan_id, plan.name, gateway);
    }

    // Notify tenant
    const statusEmoji = result.status === "approved" ? "✅" : "💳";
    const statusMsg = result.status === "approved"
      ? `Plano ${plan.name} ativado com sucesso!`
      : `Cobrança de R$ ${plan.price.toFixed(2)} criada. Aguardando pagamento.`;

    await supabase.from("admin_notifications").insert({
      sender_user_id: user_id,
      target_user_id: user_id,
      title: `${statusEmoji} ${result.status === "approved" ? "Plano Ativado!" : "Cobrança Criada"}`,
      message: statusMsg,
      type: result.status === "approved" ? "plan_activated" : "payment_pending",
    });

    return json({
      success: true,
      status: result.status,
      method,
      gateway,
      plan_name: plan.name,
      plan_price: plan.price,
      transaction_id: result.gateway_payment_id,
      pix: result.pix || null,
      boleto: result.boleto || null,
      card: result.card || null,
    });
  } catch (error: any) {
    console.error("Subscribe error:", error);
    return json({ error: error.message }, 500);
  }
});

// ===================== HELPERS =====================

function detectGateway(cfg: Record<string, string>): string {
  if (cfg.asaas_api_key) return "asaas";
  if (cfg.mercadopago_global_key) return "mercadopago";
  if (cfg.pagbank_global_key) return "pagbank";
  if (cfg.amplopay_secret_key) return "amplopay";
  return "";
}

function getGatewayKeys(gw: string, cfg: Record<string, string>) {
  if (gw === "mercadopago") return { secretKey: cfg.mercadopago_global_key, publicKey: cfg.mercadopago_public_key };
  if (gw === "pagbank") return { secretKey: cfg.pagbank_global_key, publicKey: cfg.pagbank_public_key };
  if (gw === "amplopay") return { secretKey: cfg.amplopay_secret_key, publicKey: cfg.amplopay_public_key };
  if (gw === "asaas") return { secretKey: cfg.asaas_api_key, publicKey: "" };
  return { secretKey: "", publicKey: "" };
}

function getAvailableMethods(gw: string): string[] {
  if (gw === "mercadopago") return ["PIX", "CREDIT_CARD", "BOLETO"];
  if (gw === "pagbank") return ["PIX", "CREDIT_CARD", "BOLETO"];
  if (gw === "amplopay") return ["PIX", "BOLETO"];
  if (gw === "asaas") return ["PIX", "CREDIT_CARD", "BOLETO"];
  return [];
}

async function activateSubscription(supabase: any, userId: string, planId: string, planName: string, gateway: string) {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: existingSub } = await supabase
    .from("tenant_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingSub) {
    await supabase
      .from("tenant_subscriptions")
      .update({
        plan_id: planId,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        trial_ends_at: null,
        updated_at: now.toISOString(),
      })
      .eq("id", existingSub.id);
  } else {
    await supabase
      .from("tenant_subscriptions")
      .insert({
        user_id: userId,
        plan_id: planId,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      });
  }

  // Cancel pending plan change requests
  await supabase
    .from("plan_change_requests")
    .update({ status: "approved", resolved_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("status", "pending");
}

// ===================== MERCADO PAGO =====================

async function processMercadoPago(
  accessToken: string, plan: any, method: string,
  email: string, name: string, document: string,
  cardToken?: string, installments?: number, userId?: string,
  deviceId?: string, paymentMethodId?: string, issuerId?: string
) {
  const paymentData: any = {
    transaction_amount: Number(plan.price),
    description: `Assinatura plano ${plan.name}`,
    external_reference: `plan_${plan.id}_user_${userId}`,
    payer: {
      email,
      first_name: name.split(" ")[0],
      last_name: name.split(" ").slice(1).join(" ") || "",
      identification: document ? { type: document.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF", number: document.replace(/\D/g, "") } : undefined,
    },
  };

  if (method === "PIX") {
    paymentData.payment_method_id = "pix";
  } else if (method === "CREDIT_CARD") {
    if (!cardToken) throw new Error("Token do cartão é obrigatório. Use o SDK do Mercado Pago para gerar o token.");
    paymentData.token = cardToken;
    paymentData.installments = installments || 1;
    if (paymentMethodId) paymentData.payment_method_id = paymentMethodId;
    if (issuerId) paymentData.issuer_id = Number(issuerId);
  } else if (method === "BOLETO") {
    paymentData.payment_method_id = "bolbradesco";
    // For Boleto, MP requires an address. Since this is a SaaS subscription, we'll use a standard fallback or tenant profile data if available.
    paymentData.payer.address = {
      zip_code: "01000000",
      street_name: "Rua",
      street_number: "100",
      neighborhood: "Centro",
      city: "São Paulo",
      federal_unit: "SP",
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Idempotency-Key": `plan-${plan.id}-${userId}-${Date.now()}`,
  };

  if (deviceId) {
    headers["X-Meli-Session-Id"] = deviceId;
  }

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers,
    body: JSON.stringify(paymentData),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("MP Subscribe Error:", JSON.stringify(data));
    if (data.message?.includes("access_token")) throw new Error("Access Token do Mercado Pago inválido ou expirado.");
    throw new Error(data.message || data.cause?.[0]?.description || `Erro HTTP ${res.status} no Mercado Pago`);
  }

  const statusMap: Record<string, string> = { approved: "approved", pending: "pending", authorized: "pending", in_process: "pending", rejected: "rejected", cancelled: "cancelled" };
  const status = statusMap[data.status] || "pending";

  // Friendly decline message for credit card
  if (status === "rejected" && method === "CREDIT_CARD") {
    const reasons: Record<string, string> = {
      cc_rejected_insufficient_amount: "limite insuficiente",
      cc_rejected_bad_filled_card_number: "número do cartão inválido",
      cc_rejected_bad_filled_date: "data de validade incorreta",
      cc_rejected_bad_filled_security_code: "CVV incorreto",
      cc_rejected_bad_filled_other: "dados do cartão incorretos",
      cc_rejected_high_risk: "suspeita de fraude — use outro cartão ou PIX",
      cc_rejected_call_for_authorize: "autorize a compra junto ao banco emissor",
      cc_rejected_card_disabled: "cartão desabilitado pelo banco",
      cc_rejected_other_reason: "recusado pelo banco emissor",
      cc_rejected_max_attempts: "máximo de tentativas atingido",
    };
    const reason = reasons[data.status_detail] || "recusado pelo banco emissor";
    throw new Error(`❌ Pagamento recusado: ${reason}. Tente outro cartão ou método.`);
  }

  const result: any = { gateway_payment_id: String(data.id), status };

  if (method === "PIX" && data.point_of_interaction?.transaction_data) {
    result.pix = {
      qrCode: data.point_of_interaction.transaction_data.qr_code,
      qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64,
      expiration: data.date_of_expiration,
    };
  }
  if (method === "BOLETO" && data.transaction_details) {
    result.boleto = {
      url: data.transaction_details.external_resource_url,
      barcode: data.barcode?.content,
      dueDate: data.date_of_expiration,
    };
  }
  if (method === "CREDIT_CARD") {
    result.card = {
      status,
      brand: data.payment_method_id,
      lastFour: data.card?.last_four_digits,
    };
  }

  return result;
}

// ===================== PAGBANK =====================

async function processPagBank(
  token: string, environment: string, plan: any, method: string,
  email: string, name: string, document: string, phone: string,
  cardToken?: string, userId?: string
) {
  const baseUrl = environment === "production" ? "https://api.pagseguro.com" : "https://sandbox.api.pagseguro.com";
  const amountCents = Math.round(Number(plan.price) * 100);

  const orderData: any = {
    reference_id: `plan_${plan.id}_user_${userId}_${Date.now()}`,
    customer: {
      name: name || "Cliente",
      email: email,
      tax_id: (document || "00000000000").replace(/\D/g, ""),
      phones: phone ? [{ country: "55", area: phone.replace(/\D/g, "").slice(0, 2), number: phone.replace(/\D/g, "").slice(2), type: "MOBILE" }] : [],
    },
    items: [{ reference_id: plan.id, name: `Plano ${plan.name}`, quantity: 1, unit_amount: amountCents }],
    charges: [] as any[],
  };

  if (method === "PIX") {
    orderData.qr_codes = [{ amount: { value: amountCents }, expiration_date: new Date(Date.now() + 3600 * 1000).toISOString() }];
  } else if (method === "BOLETO") {
    orderData.charges.push({
      reference_id: crypto.randomUUID(),
      description: `Plano ${plan.name}`,
      amount: { value: amountCents, currency: "BRL" },
      payment_method: {
        type: "BOLETO",
        boleto: {
          due_date: new Date(Date.now() + 3 * 86400 * 1000).toISOString().split("T")[0],
          instruction_lines: { line_1: `Assinatura plano ${plan.name}`, line_2: "" },
          holder: {
            name: name || "Cliente",
            tax_id: (document || "00000000000").replace(/\D/g, ""),
            email,
            address: { street: "Rua", number: "0", locality: "Centro", city: "São Paulo", region_code: "SP", country: "BRA", postal_code: "01000000" },
          },
        },
      },
    });
  } else if (method === "CREDIT_CARD") {
    if (!cardToken) throw new Error("Token do cartão PagBank é obrigatório.");
    orderData.charges.push({
      reference_id: crypto.randomUUID(),
      description: `Plano ${plan.name}`,
      amount: { value: amountCents, currency: "BRL" },
      payment_method: {
        type: "CREDIT_CARD",
        installments: 1,
        capture: true,
        card: { encrypted: cardToken },
        holder: { name: name || "Cliente", tax_id: (document || "00000000000").replace(/\D/g, "") },
      },
    });
  }

  const res = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(orderData),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("PagBank Subscribe Error:", JSON.stringify(data));
    if (res.status === 401) throw new Error("Token do PagBank inválido ou expirado.");
    throw new Error(data.error_messages?.[0]?.description || `Erro HTTP ${res.status} no PagBank`);
  }

  const result: any = { gateway_payment_id: data.id, status: "pending" };

  if (method === "PIX" && data.qr_codes?.[0]) {
    const qr = data.qr_codes[0];
    result.pix = {
      qrCode: qr.text,
      qrCodeBase64: qr.links?.find((l: any) => l.media === "image/png")?.href,
      expiration: qr.expiration_date,
    };
  }
  if (method === "BOLETO" && data.charges?.[0]) {
    const charge = data.charges[0];
    result.boleto = {
      url: charge.links?.find((l: any) => l.rel === "BOLETO.PDF")?.href,
      barcode: charge.payment_method?.boleto?.barcode,
      dueDate: charge.payment_method?.boleto?.due_date,
    };
  }
  if (method === "CREDIT_CARD" && data.charges?.[0]) {
    const charge = data.charges[0];
    const chStatus = String(charge.status || "").toUpperCase();
    if (chStatus === "DECLINED" || chStatus === "CANCELED" || chStatus === "CANCELLED") {
      const reason = charge.payment_response?.message || charge.payment_response?.reference || "Cartão recusado pelo banco emissor.";
      throw new Error(`❌ Pagamento recusado: ${reason}. Tente outro cartão ou método.`);
    }
    result.status = chStatus === "PAID" ? "approved" : "pending";
    result.card = {
      status: result.status,
      brand: charge.payment_method?.card?.brand,
      lastFour: charge.payment_method?.card?.last_digits,
    };
  }

  return result;
}

// ===================== AMPLOPAY =====================

async function processAmplopay(
  secretKey: string, publicKey: string, plan: any, method: string,
  email: string, name: string, document: string, phone: string, userId: string
) {
  const BASE_URL = "https://app.amplopay.com/api/v1";
  const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/amplopay-webhook`;
  const identifier = `plan_${plan.id}_user_${userId}_${Date.now()}`;

  const clientData = { name, email, phone: phone || "(00) 0 0000-0000", document: document?.replace(/\D/g, "") || "00000000000" };
  const product = { id: plan.id, name: `Plano ${plan.name}`, quantity: 1, price: Number(plan.price) };

  let endpoint = "";
  let requestBody: any = {};

  if (method === "PIX") {
    endpoint = `${BASE_URL}/gateway/pix/subscription`;
    requestBody = {
      identifier, amount: plan.price, product,
      subscription: { periodicityType: "MONTHS", periodicity: 1, firstChargeIn: 0 },
      client: clientData, callbackUrl,
    };
  } else if (method === "BOLETO") {
    endpoint = `${BASE_URL}/gateway/boleto/receive`;
    requestBody = {
      identifier, amount: plan.price, product,
      dueDate: new Date(Date.now() + 3 * 86400 * 1000).toISOString().split("T")[0],
      client: clientData, callbackUrl,
    };
  } else {
    throw new Error("Amplopay suporta apenas PIX e Boleto para assinaturas.");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json", "x-secret-key": secretKey };
  if (publicKey) headers["x-public-key"] = publicKey;

  const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(requestBody) });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`Resposta inválida do Amplopay: ${text.slice(0, 200)}`); }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error("Chaves do Amplopay inválidas.");
    throw new Error(data.message || data.error || `Erro HTTP ${res.status} no Amplopay`);
  }

  const result: any = { gateway_payment_id: data.transactionId || data.id || identifier, status: "pending" };

  if (method === "PIX" && data.pix) {
    result.pix = {
      qrCode: data.pix.code || data.pix.qrCode,
      qrCodeBase64: data.pix.base64 || data.pix.qrCodeBase64 || data.pix.image,
    };
  }
  if (method === "BOLETO" && data.boleto) {
    result.boleto = {
      url: data.boleto.url || data.boleto.bankSlipUrl,
      barcode: data.boleto.barcode || data.boleto.digitableLine,
      dueDate: data.boleto.dueDate,
    };
  }

  return result;
}

// ===================== ASAAS =====================
// Docs: https://docs.asaas.com/
// Production base URL: https://api.asaas.com/v3
// Auth: header "access_token: <API_KEY>"

async function processAsaas(
  apiKey: string, plan: any, method: string,
  email: string, name: string, document: string, phone: string,
  cardToken: string | undefined, card: any | undefined, installments: number | undefined, userId: string
) {
  const BASE_URL = "https://api.asaas.com/v3";
  const headers = {
    "Content-Type": "application/json",
    "access_token": apiKey,
    "User-Agent": "Cartlly/1.0",
  };
  const cleanDoc = (document || "").replace(/\D/g, "");
  const cleanPhone = (phone || "").replace(/\D/g, "");

  // 1) Find or create customer
  let customerId = "";
  try {
    const findRes = await fetch(`${BASE_URL}/customers?cpfCnpj=${cleanDoc}`, { headers });
    const findData = await findRes.json();
    if (findRes.ok && findData?.data?.[0]?.id) {
      customerId = findData.data[0].id;
    }
  } catch { /* ignore, will create */ }

  if (!customerId) {
    const createRes = await fetch(`${BASE_URL}/customers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: name || "Cliente Cartlly",
        email,
        cpfCnpj: cleanDoc,
        mobilePhone: cleanPhone || undefined,
        externalReference: userId,
        notificationDisabled: false,
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      console.error("Asaas create customer error:", JSON.stringify(createData));
      const errMsg = createData?.errors?.[0]?.description || `Erro ao criar cliente Asaas (HTTP ${createRes.status})`;
      throw new Error(errMsg);
    }
    customerId = createData.id;
  }

  // 2) Create payment
  const today = new Date();
  const dueDate = new Date(today.getTime() + (method === "BOLETO" ? 3 : 1) * 86400 * 1000)
    .toISOString().split("T")[0];

  const billingType = method === "PIX" ? "PIX"
    : method === "BOLETO" ? "BOLETO"
    : method === "CREDIT_CARD" ? "CREDIT_CARD"
    : "UNDEFINED";

  const paymentBody: any = {
    customer: customerId,
    billingType,
    value: Number(plan.price),
    dueDate,
    description: `Assinatura plano ${plan.name}`,
    externalReference: `plan_${plan.id}_user_${userId}_${Date.now()}`,
  };

  if (method === "CREDIT_CARD") {
    if (cardToken) {
      paymentBody.creditCardToken = cardToken;
    } else if (card?.number && card?.holder && card?.expiry_month && card?.expiry_year && card?.cvv) {
      paymentBody.creditCard = {
        holderName: card.holder,
        number: String(card.number).replace(/\D/g, ""),
        expiryMonth: String(card.expiry_month).padStart(2, "0"),
        expiryYear: String(card.expiry_year),
        ccv: String(card.cvv),
      };
      paymentBody.creditCardHolderInfo = {
        name: name || card.holder,
        email,
        cpfCnpj: cleanDoc,
        postalCode: "01310100",
        addressNumber: "0",
        phone: cleanPhone || undefined,
      };
    } else {
      throw new Error("Dados do cartão são obrigatórios.");
    }

    if (installments && installments > 1) {
      paymentBody.installmentCount = installments;
      paymentBody.totalValue = Number(plan.price);
    }
  }

  const payRes = await fetch(`${BASE_URL}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify(paymentBody),
  });
  const payData = await payRes.json();

  if (!payRes.ok) {
    console.error("Asaas create payment error:", JSON.stringify(payData));
    if (payRes.status === 401) throw new Error("Chave da API Asaas inválida.");

    const asaasErr = payData?.errors?.[0];
    const code = asaasErr?.code || "";
    const desc = asaasErr?.description || "";

    // Friendly messages for common decline reasons
    let friendly = desc || `Erro ao criar cobrança Asaas (HTTP ${payRes.status})`;
    if (code === "invalid_creditCard" || /não autorizada|nao autorizada/i.test(desc)) {
      friendly = "❌ Pagamento recusado pelo banco emissor. Possíveis causas:\n" +
        "• Dados do cartão incorretos (número, validade ou CVV)\n" +
        "• Limite insuficiente ou cartão bloqueado\n" +
        "• Cartão não habilitado para compras online\n" +
        "Verifique os dados ou tente outro cartão.";
    } else if (/cpf|cnpj/i.test(desc)) {
      friendly = `❌ CPF/CNPJ inválido: ${desc}`;
    } else if (/cep/i.test(desc)) {
      friendly = `❌ CEP inválido: ${desc}`;
    } else if (/email/i.test(desc)) {
      friendly = `❌ E-mail inválido: ${desc}`;
    } else if (/telefone|phone|contato/i.test(desc)) {
      friendly = `❌ Telefone inválido: ${desc}`;
    } else if (code) {
      friendly = `❌ ${desc} (código: ${code})`;
    }

    throw new Error(friendly);
  }

  const status = payData.status === "CONFIRMED" || payData.status === "RECEIVED" ? "approved"
    : payData.status === "REFUSED" || payData.status === "REFUNDED" ? "rejected"
    : "pending";

  const result: any = { gateway_payment_id: payData.id, status };

  // 3) Get PIX QR Code if applicable
  if (method === "PIX") {
    const qrRes = await fetch(`${BASE_URL}/payments/${payData.id}/pixQrCode`, { headers });
    const qrData = await qrRes.json();
    if (qrRes.ok) {
      result.pix = {
        qrCode: qrData.payload,
        qrCodeBase64: qrData.encodedImage,
        expiration: qrData.expirationDate,
      };
    }
  }

  if (method === "BOLETO") {
    result.boleto = {
      url: payData.bankSlipUrl || `${BASE_URL}/payments/${payData.id}/identificationField`,
      barcode: payData.nossoNumero || "",
      dueDate: payData.dueDate,
    };
  }

  if (method === "CREDIT_CARD") {
    result.card = {
      status,
      brand: payData.creditCard?.creditCardBrand,
      lastFour: payData.creditCard?.creditCardNumber?.slice(-4),
    };
  }

  return result;
}
