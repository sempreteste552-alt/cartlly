import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callAI } from "../_shared/ai-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let postId: string | undefined;

  try {
    const body = await req.json();
    postId = body.post_id;
    if (!postId) return json({ error: "post_id obrigatório" }, 400);

    const { data: post } = await admin.from("social_media_posts").select("*").eq("id", postId).maybeSingle();
    if (!post) return json({ error: "Post não encontrado" }, 404);
    if (post.processing_status === "PROCESSED") return json({ ok: true, skipped: true });

    await admin.from("social_media_posts").update({ processing_status: "PROCESSING" }).eq("id", post.id);

    // Contexto da loja (categorias + amostra de produtos)
    const [{ data: cats }, { data: prods }, { data: settings }, { data: store }] = await Promise.all([
      admin.from("categories").select("name").eq("user_id", post.tenant_id).limit(30),
      admin.from("products").select("name, price").eq("user_id", post.tenant_id).limit(20),
      admin.from("tenant_social_settings").select("*").eq("tenant_id", post.tenant_id).maybeSingle(),
      admin.from("store_settings").select("store_name, store_description").eq("user_id", post.tenant_id).maybeSingle(),
    ]);

    const systemPrompt = `You are a product detection engine for an e-commerce store.
Analyze a social media post (image + caption) and decide if it advertises a product sold by this store.
Store: ${store?.store_name || "loja"}. ${store?.store_description || ""}
Existing categories: ${(cats || []).map((c: any) => c.name).join(", ") || "none"}.
Existing products: ${(prods || []).map((p: any) => p.name).join(", ") || "none"}.
Rules:
- NEVER invent a price. If no explicit price is present in the caption, set suggested_price to null.
- Write name/description in Brazilian Portuguese, matching the store's tone.
- Answer ONLY with valid JSON, no markdown.
Schema: {"is_product":bool,"confidence":number,"product_name":string|null,"description":string|null,"category":string|null,"suggested_price":number|null,"brand":string|null,"sku":string|null,"tags":string[]}`;

    const userContent: any[] = [{ type: "text", text: `Legenda: ${post.caption || "(sem legenda)"}` }];
    if (post.media_url) userContent.push({ type: "image_url", image_url: { url: post.media_url } });

    const result = await callAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      feature: "SOCIAL_PRODUCT_ANALYSIS",
      store_user_id: post.tenant_id,
      user_id: post.tenant_id,
      temperature: 0.3,
    });

    await admin.rpc("bump_social_analytics", {
      p_tenant_id: post.tenant_id, p_provider: post.provider, p_field: "ai_requests", p_amount: 1,
    });
    await admin.rpc("bump_social_analytics", {
      p_tenant_id: post.tenant_id, p_provider: post.provider, p_field: "credits_consumed",
      p_amount: Number(result.estimated_cost || 0),
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(result.content.replace(/```json|```/g, "").trim());
    } catch {
      parsed = { is_product: false, confidence: 0 };
    }

    await admin
      .from("social_media_posts")
      .update({
        processing_status: parsed.is_product ? "PROCESSED" : "IGNORED",
        detected_product: Boolean(parsed.is_product),
        ai_analysis: parsed,
        processed_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    if (!parsed.is_product) {
      await admin.rpc("bump_social_analytics", {
        p_tenant_id: post.tenant_id, p_provider: post.provider, p_field: "products_ignored", p_amount: 1,
      });
      return json({ ok: true, is_product: false });
    }

    // Evita sugestão duplicada para o mesmo post
    const { data: existing } = await admin
      .from("social_product_suggestions")
      .select("id")
      .eq("social_post_id", post.id)
      .maybeSingle();

    let suggestionId = existing?.id;
    if (!suggestionId) {
      const { data: sug } = await admin
        .from("social_product_suggestions")
        .insert({
          tenant_id: post.tenant_id,
          social_post_id: post.id,
          suggested_name: parsed.product_name,
          suggested_description: parsed.description,
          suggested_category: parsed.category,
          suggested_price: parsed.suggested_price ?? null,
          suggested_brand: parsed.brand ?? null,
          suggested_sku: parsed.sku ?? null,
          suggested_tags: parsed.tags ?? [],
          image_url: post.media_url,
          ai_confidence: parsed.confidence ?? null,
          status: "PENDING",
        })
        .select("id")
        .single();
      suggestionId = sug?.id;
      await admin.rpc("bump_social_analytics", {
        p_tenant_id: post.tenant_id, p_provider: post.provider, p_field: "products_detected", p_amount: 1,
      });
    }

    if (!settings || settings.auto_notify !== false) {
      await admin.from("admin_notifications").insert({
        title: `🔔 Novo produto encontrado no ${post.provider === "instagram" ? "Instagram" : "Facebook"}`,
        message: `Encontramos um possível produto: "${parsed.product_name}". Revise e adicione à sua loja.`,
        type: "SOCIAL_NEW_PRODUCT",
        sender_user_id: post.tenant_id,
        target_user_id: post.tenant_id,
      });
    }

    return json({ ok: true, is_product: true, suggestion_id: suggestionId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na análise";
    console.error("social-analyze-post error", msg);
    if (postId) {
      await admin
        .from("social_media_posts")
        .update({ processing_status: "ERROR", error_message: msg })
        .eq("id", postId);
      const { data: p } = await admin.from("social_media_posts").select("tenant_id").eq("id", postId).maybeSingle();
      if (p) {
        await admin.from("admin_notifications").insert({
          title: "⚠️ Erro ao analisar publicação",
          message: "Não conseguimos processar esta publicação. Você pode tentar novamente no histórico de redes sociais.",
          type: "SOCIAL_IMPORT_ERROR",
          sender_user_id: p.tenant_id,
          target_user_id: p.tenant_id,
        });
      }
    }
    return json({ error: msg }, 200);
  }
});
