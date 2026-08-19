import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const { suggestion_id, name, description, price, category_id, category_name, sku, brand, stock, image_url, published } = body;

    const { data: sug } = await admin
      .from("social_product_suggestions")
      .select("*, social_media_posts(id, provider, external_post_id, post_url)")
      .eq("id", suggestion_id)
      .maybeSingle();
    if (!sug || sug.tenant_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (sug.status === "IMPORTED" && sug.product_id) {
      return json({ ok: true, product_id: sug.product_id, already: true });
    }

    // Validações obrigatórias
    if (!name || String(name).trim().length < 2) return json({ error: "Informe o nome do produto." }, 400);
    const finalPrice = Number(price);
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) return json({ error: "Informe um preço de venda maior que zero." }, 400);
    if (!image_url) return json({ error: "Informe uma imagem para o produto." }, 400);

    // Duplicidade por nome
    const { data: dup } = await admin
      .from("products")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", String(name).trim())
      .maybeSingle();
    if (dup) return json({ error: "Já existe um produto com este nome na sua loja." }, 409);

    // Categoria (cria se necessário)
    let finalCategoryId = category_id || null;
    if (!finalCategoryId && category_name) {
      const { data: existingCat } = await admin
        .from("categories").select("id").eq("user_id", user.id).ilike("name", category_name).maybeSingle();
      if (existingCat) finalCategoryId = existingCat.id;
      else {
        const { data: newCat } = await admin
          .from("categories").insert({ user_id: user.id, name: category_name }).select("id").single();
        finalCategoryId = newCat?.id ?? null;
      }
    }

    const { data: product, error: prodErr } = await admin
      .from("products")
      .insert({
        user_id: user.id,
        name: String(name).trim(),
        description: description || null,
        price: finalPrice,
        image_url,
        category_id: finalCategoryId,
        stock: Number.isFinite(Number(stock)) ? Number(stock) : 0,
        published: published !== false,
      })
      .select("id, name")
      .single();
    if (prodErr) throw prodErr;

    const post = (sug as any).social_media_posts;
    await admin.from("social_product_links").insert({
      tenant_id: user.id,
      product_id: product.id,
      social_post_id: post?.id ?? sug.social_post_id,
      provider: post?.provider ?? "instagram",
      external_post_id: post?.external_post_id ?? null,
    });

    await admin
      .from("social_product_suggestions")
      .update({
        status: "IMPORTED",
        product_id: product.id,
        suggested_name: name,
        suggested_description: description,
        suggested_price: finalPrice,
        suggested_sku: sku ?? null,
        suggested_brand: brand ?? null,
        image_url,
      })
      .eq("id", sug.id);

    await admin.rpc("bump_social_analytics", {
      p_tenant_id: user.id, p_provider: post?.provider ?? "instagram", p_field: "products_imported", p_amount: 1,
    });

    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "social.import",
      target_type: "product",
      target_id: product.id,
      target_name: product.name,
      details: { suggestion_id: sug.id, provider: post?.provider, external_post_id: post?.external_post_id, price: finalPrice },
    });

    await admin.from("admin_notifications").insert({
      title: "✅ Produto importado das redes sociais",
      message: `"${product.name}" foi adicionado à sua loja.`,
      type: "SOCIAL_PRODUCT_IMPORTED",
      sender_user_id: user.id,
      target_user_id: user.id,
    });

    return json({ ok: true, product_id: product.id });
  } catch (e) {
    console.error("social-import-product error", e);
    return json({ error: e instanceof Error ? e.message : "Erro ao importar produto" }, 400);
  }
});
