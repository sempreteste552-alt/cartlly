import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_APP_ORIGIN = "https://www.cartlly.lovable.app";

function getSafeAppOrigin(value?: string | null) {
  if (!value) return FALLBACK_APP_ORIGIN;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isPreviewHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".lovable.app") ||
      hostname.endsWith(".lovableproject.com");
    return isPreviewHost ? FALLBACK_APP_ORIGIN : url.origin;
  } catch {
    return FALLBACK_APP_ORIGIN;
  }
}

function getPasswordResetErrorMessage(message?: string) {
  if (!message) return "Não foi possível enviar o link de redefinição agora.";
  const waitMatch = message.match(/after\s+(\d+)\s+seconds?/i) || message.match(/ap[oó]s\s+(\d+)\s+segundos?/i);
  if (message.includes("over_email_send_rate_limit") || /for security purposes/i.test(message) || waitMatch) {
    const seconds = waitMatch?.[1];
    return seconds
      ? `Um link já foi solicitado há instantes. Aguarde ${seconds} segundos e tente novamente.`
      : "Um link já foi solicitado há instantes. Aguarde alguns segundos e tente novamente.";
  }
  return message;
}

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return n.toString().padStart(6, "0");
}

const SENSITIVE_ACTIONS = new Set(["update_user_email", "update_user_password", "update_store_slug"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, targetUserId, targetEmail } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action" }), { status: 400, headers: corsHeaders });
    }

    // ===== OTP HELPERS =====

    // Step 1: ask for OTP for sensitive actions
    if (action === "request_otp") {
      const { sensitiveAction, targetUserId: tUid, payload } = body;
      if (!sensitiveAction || !SENSITIVE_ACTIONS.has(sensitiveAction)) {
        return new Response(JSON.stringify({ error: "Invalid sensitive action" }), { status: 400, headers: corsHeaders });
      }
      if (!tUid) {
        return new Response(JSON.stringify({ error: "Missing targetUserId" }), { status: 400, headers: corsHeaders });
      }

      const code = generateCode();
      const code_hash = await hashCode(code);
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Invalidate any previous unused OTP for same caller+action+target
      await adminClient.from("super_admin_otps").update({ used_at: new Date().toISOString() })
        .eq("super_admin_id", caller.id)
        .eq("target_user_id", tUid)
        .eq("action", sensitiveAction)
        .is("used_at", null);

      const { error: insErr } = await adminClient.from("super_admin_otps").insert({
        super_admin_id: caller.id,
        target_user_id: tUid,
        action: sensitiveAction,
        payload: payload || {},
        code_hash,
        expires_at,
      });
      if (insErr) throw insErr;

      // Send OTP email to super admin
      const origin = getSafeAppOrigin(req.headers.get("origin") || body.origin);
      const subject = `[Cartlly] Código de confirmação: ${code}`;
      const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<h2 style="color:#7c3aed">Confirmação de ação sensível</h2>
<p>Você solicitou: <strong>${sensitiveAction}</strong> para o tenant <code>${tUid}</code>.</p>
<p>Use o código abaixo (válido por 10 min):</p>
<div style="font-size:36px;font-weight:bold;letter-spacing:8px;background:#f5f3ff;padding:18px;text-align:center;border-radius:8px;color:#7c3aed">${code}</div>
<p style="color:#666;margin-top:24px;font-size:13px">Origem: ${origin}. Se não foi você, ignore este email e verifique a auditoria do Super Admin.</p>
</body></html>`;
      try {
        await adminClient.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to: caller.email,
            from: "noreply@drpsemshiping.store",
            subject,
            html,
            text: `Seu código de confirmação é ${code} (válido por 10 minutos).`,
            purpose: "transactional",
            label: "super_admin_otp",
            idempotency_key: `sa_otp_${caller.id}_${Date.now()}`,
          },
        });
      } catch (e) {
        console.error("Failed to enqueue OTP email:", e);
      }

      // Notify the tenant by email and in-app that a sensitive change is being attempted
      try {
        const { data: targetUser } = await adminClient.auth.admin.getUserById(tUid);
        const tEmail = targetUser?.user?.email;
        if (tEmail) {
          await adminClient.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              to: tEmail,
              from: "noreply@drpsemshiping.store",
              subject: "[Cartlly] Aviso: alteração administrativa solicitada",
              html: `<p>Olá,</p><p>Um administrador da plataforma solicitou alterar dados sensíveis da sua conta (<strong>${sensitiveAction}</strong>).</p><p>Se não reconhece esta ação, entre em contato com o suporte imediatamente.</p>`,
              text: `Um administrador solicitou alterar ${sensitiveAction} da sua conta. Se não reconhece, contate o suporte.`,
              purpose: "transactional",
              label: "tenant_change_notice",
              idempotency_key: `tenant_notice_${tUid}_${Date.now()}`,
            },
          });
        }
        await adminClient.from("admin_notifications").insert({
          sender_user_id: caller.id,
          target_user_id: tUid,
          title: "🔐 Alteração administrativa solicitada",
          message: `Um super admin solicitou: ${sensitiveAction}. Caso não reconheça, contate o suporte imediatamente.`,
          type: "warning",
        });
      } catch (e) {
        console.error("Tenant notice failed:", e);
      }

      return new Response(JSON.stringify({ success: true, message: "OTP enviado para o seu email" }), { headers: corsHeaders });
    }

    // Step 2: verify and execute sensitive action
    if (action === "verify_otp_and_execute") {
      const { sensitiveAction, targetUserId: tUid, code, payload } = body;
      if (!sensitiveAction || !tUid || !code) {
        return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders });
      }
      const code_hash = await hashCode(String(code).trim());
      const { data: otp, error: otpErr } = await adminClient
        .from("super_admin_otps")
        .select("*")
        .eq("super_admin_id", caller.id)
        .eq("target_user_id", tUid)
        .eq("action", sensitiveAction)
        .is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otpErr || !otp) {
        return new Response(JSON.stringify({ error: "Nenhum código ativo. Solicite novamente." }), { status: 400, headers: corsHeaders });
      }
      if (new Date(otp.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: "Código expirado. Solicite novamente." }), { status: 400, headers: corsHeaders });
      }
      if (otp.attempts >= otp.max_attempts) {
        return new Response(JSON.stringify({ error: "Muitas tentativas. Solicite outro código." }), { status: 429, headers: corsHeaders });
      }
      if (otp.code_hash !== code_hash) {
        await adminClient.from("super_admin_otps").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
        return new Response(JSON.stringify({ error: "Código inválido" }), { status: 400, headers: corsHeaders });
      }

      // Execute the action
      const finalPayload = { ...(otp.payload || {}), ...(payload || {}) };
      let result: any = { success: true };

      try {
        if (sensitiveAction === "update_user_email") {
          const newEmail = finalPayload.newEmail;
          if (!newEmail) throw new Error("newEmail é obrigatório");
          const { error } = await adminClient.auth.admin.updateUserById(tUid, { email: newEmail, email_confirm: true });
          if (error) throw error;
          await adminClient.from("profiles").update({ email: newEmail }).eq("user_id", tUid);
        } else if (sensitiveAction === "update_user_password") {
          const newPassword = finalPayload.newPassword;
          if (!newPassword || String(newPassword).length < 8) throw new Error("Senha inválida (mínimo 8 caracteres)");
          const { error } = await adminClient.auth.admin.updateUserById(tUid, { password: newPassword });
          if (error) throw error;
        } else if (sensitiveAction === "update_store_slug") {
          const newSlug = String(finalPayload.newSlug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
          if (!newSlug || newSlug.length < 2) throw new Error("Slug inválido");
          const { error } = await adminClient.from("store_settings").update({ store_slug: newSlug }).eq("user_id", tUid);
          if (error) throw error;
        }
      } catch (execErr: any) {
        return new Response(JSON.stringify({ error: execErr.message || "Falha ao executar" }), { status: 500, headers: corsHeaders });
      }

      await adminClient.from("super_admin_otps").update({ used_at: new Date().toISOString() }).eq("id", otp.id);
      await adminClient.from("audit_logs").insert({
        actor_user_id: caller.id,
        action: `sa_${sensitiveAction}`,
        target_type: "tenant",
        target_id: tUid,
        details: finalPayload,
      });

      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    // ===== TENANT LOGS =====
    if (action === "get_tenant_logs") {
      if (!targetUserId) return new Response(JSON.stringify({ error: "Missing targetUserId" }), { status: 400, headers: corsHeaders });
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [pushLogs, paymentFails, orderFails, emailLog] = await Promise.all([
        adminClient.from("push_logs").select("id,title,body,status,error_message,created_at,event_type").eq("user_id", targetUserId).gte("created_at", since).order("created_at", { ascending: false }).limit(50),
        adminClient.from("payments").select("id,order_id,amount,gateway,method,status,status_detail,created_at").eq("user_id", targetUserId).in("status", ["refused", "failed", "cancelled"]).gte("created_at", since).order("created_at", { ascending: false }).limit(50),
        adminClient.from("orders").select("id,customer_name,total,status,created_at").eq("user_id", targetUserId).in("status", ["cancelado", "expirado"]).gte("created_at", since).order("created_at", { ascending: false }).limit(50),
        adminClient.from("email_send_log").select("id,recipient_email,template_name,status,error_message,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
      ]);
      const { data: tUser } = await adminClient.auth.admin.getUserById(targetUserId);
      const tenantEmail = tUser?.user?.email;
      const tenantEmails = emailLog.data?.filter((e: any) => e.recipient_email === tenantEmail) || [];

      return new Response(JSON.stringify({
        push: pushLogs.data || [],
        payment_failures: paymentFails.data || [],
        cancelled_orders: orderFails.data || [],
        emails: tenantEmails,
      }), { headers: corsHeaders });
    }

    // ===== IMPERSONATE (magic link) =====
    if (action === "impersonate") {
      if (!targetUserId) return new Response(JSON.stringify({ error: "Missing targetUserId" }), { status: 400, headers: corsHeaders });
      const { data: tUser } = await adminClient.auth.admin.getUserById(targetUserId);
      const email = tUser?.user?.email;
      if (!email) throw new Error("Tenant sem email");
      const origin = getSafeAppOrigin(req.headers.get("origin") || body.origin);
      const { data: linkData, error } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${origin}/` },
      });
      if (error) throw error;

      // Audit
      await adminClient.from("audit_logs").insert({
        actor_user_id: caller.id,
        action: "impersonate_tenant",
        target_type: "tenant",
        target_id: targetUserId,
        target_name: email,
      });

      // Notify tenant
      await adminClient.from("admin_notifications").insert({
        sender_user_id: caller.id,
        target_user_id: targetUserId,
        title: "🔍 Acesso de suporte",
        message: "Um administrador da plataforma acessou sua conta para fins de diagnóstico/suporte.",
        type: "info",
      });

      return new Response(JSON.stringify({ action_link: linkData.properties?.action_link }), { headers: corsHeaders });
    }

    // ===== REPAIR TOOLS =====
    if (action === "repair") {
      const { tool, targetUserId: tUid } = body;
      if (!tUid || !tool) return new Response(JSON.stringify({ error: "Missing tool or targetUserId" }), { status: 400, headers: corsHeaders });
      const out: Record<string, any> = {};

      if (tool === "resync_subscription") {
        const { data: sub } = await adminClient.from("tenant_subscriptions").select("*").eq("user_id", tUid).maybeSingle();
        if (sub) {
          await adminClient.from("tenant_subscriptions").update({
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: "active",
          }).eq("id", sub.id);
          out.message = "Assinatura ressincronizada (+30 dias)";
        } else {
          out.message = "Sem assinatura para ressincronizar";
        }
      } else if (tool === "reset_domain_token") {
        const { data: domains } = await adminClient.from("store_domains").select("id").eq("user_id", tUid);
        if (domains?.length) {
          for (const d of domains) {
            await adminClient.from("store_domains").update({
              verification_token: null,
              status: "pending_dns",
            }).eq("id", d.id);
          }
          out.message = `${domains.length} domínio(s) resetado(s)`;
        } else {
          out.message = "Sem domínios";
        }
      } else if (tool === "clear_push_subscriptions") {
        const { count } = await adminClient.from("push_subscriptions").delete({ count: "exact" }).eq("user_id", tUid);
        out.message = `${count || 0} assinatura(s) push removida(s)`;
      } else if (tool === "unblock_all") {
        await adminClient.from("profiles").update({ status: "active" }).eq("user_id", tUid);
        await adminClient.from("store_settings").update({ store_blocked: false, admin_blocked: false }).eq("user_id", tUid);
        out.message = "Tenant, loja e painel desbloqueados";
      } else {
        return new Response(JSON.stringify({ error: "Unknown repair tool" }), { status: 400, headers: corsHeaders });
      }

      await adminClient.from("audit_logs").insert({
        actor_user_id: caller.id,
        action: `repair_${tool}`,
        target_type: "tenant",
        target_id: tUid,
        details: out,
      });
      return new Response(JSON.stringify({ success: true, ...out }), { headers: corsHeaders });
    }

    // ===== READ-ONLY SQL CONSOLE (preset templates) =====
    if (action === "preset_query") {
      const { preset, targetUserId: tUid } = body;
      if (!tUid || !preset) return new Response(JSON.stringify({ error: "Missing preset or targetUserId" }), { status: 400, headers: corsHeaders });
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      let data: any[] = [];
      let error: any = null;
      if (preset === "recent_orders") {
        const r = await adminClient.from("orders").select("id,customer_name,customer_email,total,status,created_at").eq("user_id", tUid).order("created_at", { ascending: false }).limit(50);
        data = r.data || []; error = r.error;
      } else if (preset === "refused_payments") {
        const r = await adminClient.from("payments").select("id,order_id,amount,gateway,method,status,status_detail,created_at").eq("user_id", tUid).eq("status", "refused").order("created_at", { ascending: false }).limit(50);
        data = r.data || []; error = r.error;
      } else if (preset === "low_stock_products") {
        const r = await adminClient.from("products").select("id,name,stock,min_stock_alert,published").eq("user_id", tUid).order("stock", { ascending: true }).limit(50);
        data = (r.data || []).filter((p: any) => p.stock <= (p.min_stock_alert || 5));
        error = r.error;
      } else if (preset === "abandoned_carts") {
        const r = await adminClient.from("abandoned_carts").select("id,total,abandoned_at,recovered,reminder_sent_count").eq("user_id", tUid).gte("created_at", since).order("abandoned_at", { ascending: false }).limit(50);
        data = r.data || []; error = r.error;
      } else if (preset === "recent_customers") {
        const r = await adminClient.from("customers").select("id,name,email,phone,created_at").eq("store_user_id", tUid).order("created_at", { ascending: false }).limit(50);
        data = r.data || []; error = r.error;
      } else {
        return new Response(JSON.stringify({ error: "Unknown preset" }), { status: 400, headers: corsHeaders });
      } else if (preset === "recent_customers") {
        const r = await adminClient.from("customers").select("*").eq("store_user_id", tUid).order("created_at", { ascending: false }).limit(50);
        data = r.data || []; error = r.error;
      }
      if (error) throw error;
      return new Response(JSON.stringify({ data }), { headers: corsHeaders });
    }

    // ===== TEST AI CONNECTION =====
    if (action === "test_ai_provider") {
      const { providerId } = body;
      if (!providerId) return new Response(JSON.stringify({ error: "Missing providerId" }), { status: 400, headers: corsHeaders });
      
      const { data: provider, error: pErr } = await adminClient
        .from("ai_providers")
        .select("*")
        .eq("id", providerId)
        .single();
      
      if (pErr || !provider) throw new Error("Provedor não encontrado");

      const providerName = provider.name.toLowerCase();
      let testUrl = "";
      let testBody = {};
      let testHeaders: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (providerName.includes("openai")) {
        testUrl = "https://api.openai.com/v1/chat/completions";
        testHeaders["Authorization"] = `Bearer ${provider.api_key}`;
        testBody = {
          model: provider.model_text_default || "gpt-3.5-turbo",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5
        };
      } else if (providerName.includes("gemini") || providerName.includes("google")) {
        const model = provider.model_text_default || "gemini-pro";
        testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${provider.api_key}`;
        testBody = {
          contents: [{ parts: [{ text: "hi" }] }]
        };
      } else if (providerName.includes("anthropic") || providerName.includes("claude")) {
        testUrl = "https://api.anthropic.com/v1/messages";
        testHeaders["x-api-key"] = provider.api_key;
        testHeaders["anthropic-version"] = "2023-06-01";
        testBody = {
          model: provider.model_text_default || "claude-3-haiku-20240307",
          max_tokens: 5,
          messages: [{ role: "user", content: "hi" }]
        };
      } else {
        // Fallback or generic test?
        return new Response(JSON.stringify({ error: "Tipo de provedor não suportado para teste automático" }), { status: 400, headers: corsHeaders });
      }

      try {
        const resp = await fetch(testUrl, {
          method: "POST",
          headers: testHeaders,
          body: JSON.stringify(testBody)
        });

        if (!resp.ok) {
          const errData = await resp.json();
          return new Response(JSON.stringify({ 
            success: false, 
            error: `API error (${resp.status}): ${JSON.stringify(errData)}` 
          }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ success: true, message: "Conexão estabelecida com sucesso!" }), { headers: corsHeaders });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders });
      }
    }

    // ===== TEST TENANT INTEGRITY =====
    if (action === "test_tenant_integrity") {
      if (!targetUserId) return new Response(JSON.stringify({ error: "Missing targetUserId" }), { status: 400, headers: corsHeaders });
      
      const results: any[] = [];
      
      // 1. Check Profile
      const { data: profile } = await adminClient.from("profiles").select("*").eq("user_id", targetUserId).maybeSingle();
      results.push({
        check: "Profile",
        status: profile ? "ok" : "fail",
        message: profile ? `OK (Status: ${profile.status})` : "Perfil não encontrado na tabela profiles"
      });

      // 2. Check Store Settings
      const { data: store } = await adminClient.from("store_settings").select("*").eq("user_id", targetUserId).maybeSingle();
      results.push({
        check: "Store Settings",
        status: store ? "ok" : "fail",
        message: store ? `OK (Slug: ${store.store_slug})` : "Configurações da loja não encontradas"
      });

      // 3. Check Subscription
      const { data: sub } = await adminClient.from("tenant_subscriptions").select("*").eq("user_id", targetUserId).maybeSingle();
      results.push({
        check: "Subscription",
        status: sub && ["active", "trial"].includes(sub.status) ? "ok" : "warn",
        message: sub ? `Status: ${sub.status} (Expira: ${sub.current_period_end})` : "Sem assinatura ativa"
      });

      // 4. Check Payment Methods
      const hasPix = store?.payment_pix;
      const hasCard = store?.payment_credit_card;
      const asaasKey = store?.asaas_api_key;
      results.push({
        check: "Pagamentos",
        status: (hasPix || hasCard) ? (asaasKey ? "ok" : "warn") : "warn",
        message: (hasPix || hasCard) 
          ? (asaasKey ? "Ativos e com API Key Asaas" : "Ativos mas SEM API Key Asaas configurada")
          : "Nenhum método de pagamento ativo"
      });

      // 5. Check Domains
      const { data: domains } = await adminClient.from("store_domains").select("*").eq("user_id", targetUserId);
      const activeDomain = domains?.find(d => d.status === "active");
      results.push({
        check: "Domínios",
        status: domains?.length ? (activeDomain ? "ok" : "warn") : "ok",
        message: domains?.length 
          ? (activeDomain ? `Domínio ativo: ${activeDomain.hostname}` : "Domínios cadastrados mas nenhum verificado/ativo")
          : "Utilizando apenas slug da plataforma"
      });

      // 6. Check for pending orders
      const { count: pendingCount } = await adminClient.from("orders").select("*", { count: "exact", head: true }).eq("user_id", targetUserId).eq("status", "pendente");
      results.push({
        check: "Pedidos Pendentes",
        status: (pendingCount || 0) > 20 ? "warn" : "ok",
        message: `${pendingCount || 0} pedidos pendentes`
      });

      return new Response(JSON.stringify({ success: true, results }), { headers: corsHeaders });
    }


    // ===== EXISTING ACTIONS =====
    switch (action) {
      case "resend_verification": {
        if (!targetEmail) return new Response(JSON.stringify({ error: "Missing targetEmail" }), { status: 400, headers: corsHeaders });
        const { error } = await adminClient.auth.resend({ type: "signup", email: targetEmail });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Verification email resent" }), { headers: corsHeaders });
      }
      case "send_password_reset": {
        if (!targetEmail) return new Response(JSON.stringify({ error: "Missing targetEmail" }), { status: 400, headers: corsHeaders });
        const origin = getSafeAppOrigin(req.headers.get("origin") || body.origin);
        const { error } = await adminClient.auth.resetPasswordForEmail(targetEmail, { redirectTo: `${origin}/reset-password` });
        if (error) throw new Error(getPasswordResetErrorMessage(error.message));
        return new Response(JSON.stringify({ success: true, message: "Password reset email sent" }), { headers: corsHeaders });
      }
      case "manual_activate": {
        if (!targetUserId) return new Response(JSON.stringify({ error: "Missing targetUserId" }), { status: 400, headers: corsHeaders });
        const { error: profileError } = await adminClient.from("profiles").update({ status: "active" }).eq("user_id", targetUserId);
        if (profileError) throw profileError;
        const { error: authError } = await adminClient.auth.admin.updateUserById(targetUserId, { email_confirm: true });
        if (authError) console.error("Auth confirm error:", authError);
        return new Response(JSON.stringify({ success: true, message: "Account manually activated" }), { headers: corsHeaders });
      }
      case "deactivate": {
        if (!targetUserId) return new Response(JSON.stringify({ error: "Missing targetUserId" }), { status: 400, headers: corsHeaders });
        const { error } = await adminClient.from("profiles").update({ status: "blocked" }).eq("user_id", targetUserId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Account deactivated" }), { headers: corsHeaders });
      }
      case "get_user_info": {
        if (!targetUserId) return new Response(JSON.stringify({ error: "Missing targetUserId" }), { status: 400, headers: corsHeaders });
        const { data: userData, error } = await adminClient.auth.admin.getUserById(targetUserId);
        if (error) throw error;
        return new Response(JSON.stringify({
          email: userData.user?.email,
          email_confirmed: !!userData.user?.email_confirmed_at,
          confirmed_at: userData.user?.email_confirmed_at,
          created_at: userData.user?.created_at,
          last_sign_in: userData.user?.last_sign_in_at,
        }), { headers: corsHeaders });
      }
      case "update_user": {
        // LEGACY (kept for compat) — non-sensitive flags only.
        // Sensitive changes (email/password) MUST use request_otp + verify_otp_and_execute.
        if (!targetUserId) return new Response(JSON.stringify({ error: "Missing targetUserId" }), { status: 400, headers: corsHeaders });
        const updates: Record<string, any> = {};
        if (body.emailConfirm !== undefined) updates.email_confirm = body.emailConfirm;
        if (Object.keys(updates).length === 0) {
          return new Response(JSON.stringify({ error: "Use request_otp para alterar email/senha" }), { status: 400, headers: corsHeaders });
        }
        const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, updates);
        if (updateError) throw updateError;
        return new Response(JSON.stringify({ success: true, message: "User updated" }), { headers: corsHeaders });
      }
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
    }
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
