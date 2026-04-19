import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PaymentRequest {
  order_id: string;
  method: "pix" | "credit_card" | "boleto" | "debit_card" | "express";
  card_token?: string;
  card_type?: "credit" | "debit";
  installments?: number;
  store_user_id: string;
  payer_cpf?: string;
  payer_first_name?: string;
  payer_last_name?: string;
  device_id?: string;
  payment_method_id?: string;
  issuer_id?: string;
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
          return json({ test_ok: true, message: "✅ Amplopay configurado. O teste real ocorre ao processar pagamentos.", owner_name: ownerName, owner_email: ownerEmail, store_name: testSettings.store_name });
        }

        if (gateway === "stripe") {
          const stripe = new Stripe(testSettings.gateway_secret_key, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
          const stripeUser = await stripe.accounts.retrieve().catch(() => null);
          if (stripeUser) {
            return json({ test_ok: true, message: "✅ Stripe conectado com sucesso!", owner_name: stripeUser.settings?.dashboard.display_name || ownerName, owner_email: stripeUser.email || ownerEmail, store_name: testSettings.store_name });
          }
          // If it's a regular secret key (not connect), just check if we can list something
          await stripe.paymentIntents.list({ limit: 1 });
          return json({ test_ok: true, message: "✅ Stripe conectado (Chave API válida)!", owner_name: ownerName, owner_email: ownerEmail, store_name: testSettings.store_name });
        }

        return json({ test_ok: true, message: `Gateway ${gateway} configurado. Teste real disponível ao processar pagamentos.`, owner_name: ownerName, owner_email: ownerEmail, store_name: testSettings.store_name });
      } catch (testError: any) {
        return json({ test_ok: false, error: "Erro de conexão com o gateway: " + testError.message });
      }
    }

    // ==================== PAYMENT PROCESSING ====================
    const { 
      order_id, method, card_token, card_type, installments, store_user_id, 
      payer_cpf, payer_first_name, payer_last_name, device_id, payment_method_id, issuer_id 
    } = body as PaymentRequest;

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
      return json({ error: `O gateway ${gatewayLabel(gateway)} está configurado mas a chave secreta está vazia.` }, 400);
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
        paymentResult = await createMercadoPagoPayment(
          order, method, secretKey, environment, card_token, installments, 
          payer_cpf, card_type, payer_first_name, payer_last_name, device_id, 
          payment_method_id, issuer_id
        );
      } else if (gateway === "pagbank") {
        paymentResult = await createPagBankPayment(order, method, secretKey, environment, card_token, installments, payer_cpf);
      } else if (gateway === "amplopay") {
        paymentResult = await createAmplopayPayment(order, method, secretKey, publicKey, environment);
      } else if (gateway === "stripe") {
        paymentResult = await createStripePayment(order, method, secretKey, environment, card_token, installments);
      } else if (gateway === "asaas") {
        paymentResult = await createAsaasPayment(order, method, secretKey, environment, card_token, installments, payer_cpf, payer_first_name, payer_last_name);
      } else {
        return json({ error: `Gateway "${gateway}" não é suportado.` }, 400);
      }
    } catch (gwErr: any) {
      console.error(`Gateway ${gateway} error:`, gwErr.message);
      return json({
        error: `Erro no ${gatewayLabel(gateway)}: ${gwErr.message}`,
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
        status_detail: paymentResult.status_detail || null,
        issuer_id: paymentResult.issuer_id || null,
        payment_method_id: paymentResult.payment_method_id || null,
        raw_response: paymentResult.raw,
      })
      .select()
      .single();

    if (paymentErr) {
      console.error("Error saving payment:", paymentErr);
      return json({ error: "Pagamento processado mas houve erro ao salvar no banco." }, 500);
    }

    if (paymentResult.status === "approved") {
      await supabase.from("orders").update({ status: "processando" }).eq("id", order_id);
      await supabase.from("order_status_history").insert({ order_id, status: "processando" });

      await sendRichPush(store_user_id, {
        title: "✅ Pagamento aprovado!",
        body: `${order.customer_name || "Cliente"} pagou R$ ${Number(order.total).toFixed(2).replace(".", ",")} via Cartão 💳`,
        url: "/admin/pedidos",
        type: "payment_approved",
        data: { orderId: order_id, method },
      });
    }

    if (method === "pix" && paymentResult.pix_qr_code) {
      await sendRichPush(store_user_id, {
        title: "💰 PIX gerado!",
        body: `PIX de R$ ${Number(order.total).toFixed(2).replace(".", ",")} gerado para ${order.customer_name || "Cliente"} 🎯`,
        url: "/admin/pedidos",
        type: "pix_generated",
        data: { orderId: order_id, paymentId: payment.id },
      });
    }

    if (method === "boleto" && paymentResult.boleto_url) {
      await sendRichPush(store_user_id, {
        title: "📄 Boleto gerado!",
        body: `Boleto de R$ ${Number(order.total).toFixed(2).replace(".", ",")} gerado para ${order.customer_name || "Cliente"} 📋`,
        url: "/admin/pedidos",
        type: "boleto_generated",
        data: { orderId: order_id, paymentId: payment.id },
      });
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
  installments?: number,
  payerCpf?: string,
  cardType?: "credit" | "debit",
  payerFirstName?: string,
  payerLastName?: string,
  deviceId?: string,
  paymentMethodId?: string,
  issuerId?: string
) {
  const baseUrl = "https://api.mercadopago.com/v1";
  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?gateway=mercadopago`;

  const firstName = (payerFirstName || order.payer_first_name || order.customer_name?.split(" ")[0] || "Cliente").trim();
  let lastName = (payerLastName || order.payer_last_name || order.customer_name?.split(" ").slice(1).join(" ") || "").trim();

  if (!lastName || lastName === firstName) lastName = "de Oliveira"; // Default last name if missing for MP requirements

  const paymentData: any = {
    transaction_amount: Number(Number(order.total).toFixed(2)),
    description: `Pedido #${order.id.slice(0, 8)} na ${order.store_name || "Loja"}`,
    external_reference: order.id,
    notification_url: webhookUrl,
    payer: {
      email: order.customer_email || "cliente@email.com",
      first_name: firstName,
      last_name: lastName,
    },
  };

  // Identification (CPF) is mandatory for Brazil
  if (payerCpf) {
    paymentData.payer.identification = {
      type: "CPF",
      number: payerCpf.replace(/\D/g, ""),
    };
  }

  if (method === "pix") {
    paymentData.payment_method_id = "pix";
  } else if (method === "credit_card" || method === "debit_card") {
    if (!cardToken) throw new Error("Token do cartão é obrigatório");
    paymentData.token = cardToken;
    paymentData.installments = (method === "debit_card" || cardType === "debit") ? 1 : (installments || 1);
    if (paymentMethodId) paymentData.payment_method_id = paymentMethodId;
    if (issuerId) paymentData.issuer_id = Number(issuerId);
  } else if (method === "boleto") {
    paymentData.payment_method_id = "bolbradesco";
    
    // Boleto requires full address in Brazil
    // Attempt to extract address from order or use valid fallbacks
    const zipCode = (order.shipping_cep || order.customer_cep || "01000000").replace(/\D/g, "");
    const streetName = order.shipping_street || order.customer_address || "Rua Principal";
    const streetNumber = order.shipping_number || "100";
    const neighborhood = order.shipping_neighborhood || "Centro";
    const city = order.shipping_city || "São Paulo";
    const federalUnit = order.shipping_state || "SP";

    paymentData.payer.address = {
      zip_code: zipCode.length === 8 ? zipCode : "01000000",
      street_name: streetName,
      street_number: streetNumber,
      neighborhood: neighborhood,
      city: city,
      federal_unit: federalUnit,
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Idempotency-Key": crypto.randomUUID(),
  };

  if (deviceId) {
    headers["X-Meli-Session-Id"] = deviceId;
  }

  console.log("MP Payload:", JSON.stringify(paymentData));

  const response = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify(paymentData),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("MP API Error:", JSON.stringify(data));
    const errorMessage = data.message || data.cause?.[0]?.description || `Erro Mercado Pago (${response.status})`;
    const errorDetail = data.cause?.[0]?.code || "internal_error";
    
    // Log more specific error for high-risk rejections
    if (data.status === "rejected" && data.status_detail === "cc_rejected_high_risk") {
      console.warn(`Payment rejected due to high risk. Order ID: ${order.id}`);
    }
    
    throw new Error(`${errorMessage} (Ref: ${errorDetail})`);
  }

  const mappedStatus = mapMPStatus(data.status);

  // If card was rejected by the bank, throw a friendly error so the client sees the reason
  if (mappedStatus === "rejected" && (method === "credit_card" || method === "debit_card")) {
    const reason = mpRejectionMessage(data.status_detail);
    console.warn(`MP card rejected: ${data.status_detail} (Order ${order.id})`);
    throw new Error(reason);
  }

  const result: any = {
    gateway_payment_id: String(data.id),
    status: mappedStatus,
    status_detail: data.status_detail,
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

  if ((method === "credit_card" || method === "debit_card") && data.card) {
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

// Mercado Pago decline reasons → friendly Portuguese messages
function mpRejectionMessage(detail?: string): string {
  const map: Record<string, string> = {
    cc_rejected_insufficient_amount: "❌ Cartão recusado: limite insuficiente. Tente outro cartão ou método.",
    cc_rejected_bad_filled_card_number: "❌ Número do cartão inválido. Verifique e tente novamente.",
    cc_rejected_bad_filled_date: "❌ Data de validade incorreta. Verifique e tente novamente.",
    cc_rejected_bad_filled_security_code: "❌ Código de segurança (CVV) incorreto.",
    cc_rejected_bad_filled_other: "❌ Dados do cartão incorretos. Confira número, validade e CVV.",
    cc_rejected_high_risk: "❌ Pagamento recusado por suspeita de fraude. Use outro cartão ou PIX.",
    cc_rejected_call_for_authorize: "❌ Você precisa autorizar a compra junto ao banco emissor antes de tentar novamente.",
    cc_rejected_card_disabled: "❌ Cartão desabilitado. Entre em contato com o banco emissor.",
    cc_rejected_card_error: "❌ Erro ao processar o cartão. Tente novamente ou use outro cartão.",
    cc_rejected_duplicated_payment: "❌ Pagamento duplicado detectado. Aguarde alguns minutos antes de tentar de novo.",
    cc_rejected_invalid_installments: "❌ Quantidade de parcelas inválida para este cartão.",
    cc_rejected_max_attempts: "❌ Número máximo de tentativas atingido. Tente outro cartão.",
    cc_rejected_other_reason: "❌ Cartão recusado pelo banco emissor. Tente outro cartão ou método.",
    cc_rejected_blacklist: "❌ Cartão bloqueado pelo banco. Entre em contato com o emissor.",
  };
  return map[detail || ""] || "❌ Pagamento recusado pelo banco emissor. Verifique os dados ou tente outro cartão.";
}

// ===================== PAGBANK =====================

async function createPagBankPayment(
  order: any, method: string, token: string, environment: string, 
  cardToken?: string, installments?: number, payerCpf?: string
) {
  const baseUrl = environment === "production" ? "https://api.pagseguro.com" : "https://sandbox.api.pagseguro.com";

  const orderData: any = {
    reference_id: order.id,
    customer: {
      name: order.customer_name || "Cliente",
      email: order.customer_email || "cliente@email.com",
      tax_id: (payerCpf || order.customer_cpf || "00000000000").replace(/\D/g, ""),
      phones: order.customer_phone ? [{ country: "55", area: order.customer_phone.replace(/\D/g, "").slice(0, 2), number: order.customer_phone.replace(/\D/g, "").slice(2), type: "MOBILE" }] : [],
    },
    items: [{ reference_id: order.id, name: `Pedido #${order.id.slice(0, 8)}`, quantity: 1, unit_amount: Math.round(Number(order.total) * 100) }],
    charges: [] as any[],
  };

  if (method === "pix") {
    orderData.qr_codes = [{ amount: { value: Math.round(Number(order.total) * 100) }, expiration_date: new Date(Date.now() + 3600 * 1000).toISOString() }];
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
            tax_id: (payerCpf || order.customer_cpf || "00000000000").replace(/\D/g, ""),
            email: order.customer_email || "cliente@email.com",
            address: {
              street: order.shipping_street || "Rua",
              number: order.shipping_number || "0",
              locality: order.shipping_neighborhood || "Centro",
              city: order.shipping_city || "São Paulo",
              region_code: order.shipping_state || "SP",
              country: "BRA",
              postal_code: (order.shipping_cep || "01000000").replace(/\D/g, ""),
            },
          },
        },
      },
    });
  } else if (method === "credit_card") {
    if (!cardToken) throw new Error("Token do cartão obrigatório para PagBank");
    orderData.charges.push({
      reference_id: crypto.randomUUID(),
      description: `Pedido #${order.id.slice(0, 8)}`,
      amount: { value: Math.round(Number(order.total) * 100), currency: "BRL" },
      payment_method: {
        type: "CREDIT_CARD",
        installments: installments || 1,
        capture: true,
        card: { encrypted: cardToken },
        holder: { name: order.customer_name || "Cliente", tax_id: (payerCpf || order.customer_cpf || "00000000000").replace(/\D/g, "") },
      },
    });
  }

  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(orderData),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("PagBank Error:", JSON.stringify(data));
    throw new Error(data.error_messages?.[0]?.description || `Erro PagBank (${response.status})`);
  }

  const result: any = { gateway_payment_id: data.id, status: "pending", raw: data };

  if (method === "pix" && data.qr_codes?.[0]) {
    const qr = data.qr_codes[0];
    result.pix_qr_code = qr.text;
    result.pix_qr_code_base64 = qr.links?.find((l: any) => l.media === "image/png")?.href;
    result.pix_expiration = qr.expiration_date;
  }

  if (method === "boleto" && data.charges?.[0]) {
    const charge = data.charges[0];
    result.boleto_url = charge.links?.find((l: any) => l.rel === "BOLETO.PDF")?.href;
    result.boleto_barcode = charge.payment_method?.boleto?.barcode;
    result.boleto_expiration = charge.payment_method?.boleto?.due_date;
  }

  if (method === "credit_card" && data.charges?.[0]) {
    const charge = data.charges[0];
    const chStatus = String(charge.status || "").toUpperCase();
    if (chStatus === "DECLINED" || chStatus === "CANCELED" || chStatus === "CANCELLED") {
      const reason = charge.payment_response?.message || charge.payment_response?.reference || "Cartão recusado pelo banco emissor.";
      console.warn(`PagBank card declined: ${chStatus} - ${reason}`);
      throw new Error(`❌ Pagamento recusado: ${reason}. Tente outro cartão ou método.`);
    }
    result.status = chStatus === "PAID" ? "approved" : "pending";
    result.status_detail = charge.payment_response?.code || chStatus;
    result.card_last_four = charge.payment_method?.card?.last_digits;
    result.card_brand = charge.payment_method?.card?.brand;
  }

  return result;
}

// ===================== AMPLOPAY =====================

async function createAmplopayPayment(order: any, method: string, secretKey: string, publicKey: string | null, environment: string) {
  const BASE_URL = "https://app.amplopay.com/api/v1";
  const clientData = { name: order.customer_name || "Cliente", email: order.customer_email || "cliente@email.com", phone: order.customer_phone || "(00) 0 0000-0000", document: "00000000000" };
  const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?gateway=amplopay`;
  const identifier = `order_${order.id}_${Date.now()}`;

  let endpoint = "";
  let requestBody: any = {};

  if (method === "pix") {
    endpoint = `${BASE_URL}/gateway/pix/receive`;
    requestBody = { identifier, amount: Number(order.total), product: { id: order.id, name: `Pedido #${order.id.slice(0, 8)}`, quantity: 1, price: Number(order.total) }, client: clientData, callbackUrl };
  } else if (method === "boleto") {
    endpoint = `${BASE_URL}/gateway/boleto/receive`;
    requestBody = { identifier, amount: Number(order.total), product: { id: order.id, name: `Pedido #${order.id.slice(0, 8)}`, quantity: 1, price: Number(order.total) }, dueDate: new Date(Date.now() + 3 * 86400 * 1000).toISOString().split("T")[0], client: clientData, callbackUrl };
  } else {
    throw new Error("Amplopay suporta apenas PIX e Boleto.");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json", "x-secret-key": secretKey };
  if (publicKey) headers["x-public-key"] = publicKey;

  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(requestBody) });
  const data = await response.json();

  if (!response.ok) throw new Error(data.message || data.error || `Erro Amplopay (${response.status})`);

  const result: any = { gateway_payment_id: data.transactionId || data.id || identifier, status: "pending", raw: data };

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

async function createStripePayment(
  order: any, 
  method: string, 
  secretKey: string, 
  environment: string, 
  cardToken?: string, 
  installments?: number
) {
  const stripe = new Stripe(secretKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });

  // Calculate amount in cents
  const amountCents = Math.round(Number(order.total) * 100);

  const paymentIntentParams: any = {
    amount: amountCents,
    currency: "brl",
    description: `Pedido #${order.id.slice(0, 8)} na ${order.store_name || "Loja"}`,
    metadata: {
      order_id: order.id,
    },
    confirm: true,
  };

  // If we have a payment method ID from Apple/Google Pay or similar
  if (cardToken) {
    paymentIntentParams.payment_method = cardToken;
    paymentIntentParams.return_url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?gateway=stripe&order_id=${order.id}`;
    paymentIntentParams.automatic_payment_methods = {
      enabled: true,
      allow_redirects: "never",
    };
  } else {
    // If no token, just create and let client confirm
    paymentIntentParams.confirm = false;
    paymentIntentParams.automatic_payment_methods = { enabled: true };
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

  return {
    gateway_payment_id: paymentIntent.id,
    status: mapStripeStatus(paymentIntent.status),
    status_detail: paymentIntent.status,
    raw: paymentIntent,
    client_secret: paymentIntent.client_secret,
  };
}

function mapStripeStatus(status: string): string {
  const map: Record<string, string> = {
    succeeded: "approved",
    processing: "pending",
    requires_payment_method: "pending",
    requires_confirmation: "pending",
    requires_action: "pending",
    requires_capture: "pending",
    canceled: "cancelled",
  };
  return map[status] || "pending";
}

// Already implemented below as async function sendRichPush

// ===================== RICH PUSH HELPER =====================

async function sendRichPush(targetUserId: string, payload: { title: string; body: string; url?: string; type?: string; data?: any; }) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_user_id: targetUserId, title: payload.title, body: payload.body, url: payload.url || "/admin", type: payload.type || "general", data: payload.data || {}, tag: payload.type || "default" }),
    });
  } catch (e: any) { console.error("sendRichPush error:", e.message); }
}
