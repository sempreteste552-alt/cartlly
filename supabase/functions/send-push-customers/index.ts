import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { title, body, url } = await req.json();
    if (!title) return json({ error: "Title is required" }, 400);

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Always create a message in the notification center (bell) for ALL customers
    // This ensures even customers without push subscriptions get the message
    const { data: msgRecord } = await serviceClient.from("tenant_messages").insert({
      source_tenant_id: user.id,
      sender_type: "tenant_admin",
      sender_user_id: user.id,
      audience_type: "tenant_admin_to_all_customers",
      target_area: "public_store",
      target_tenant_id: user.id,
      channel: "push_broadcast",
      title: title.trim(),
      body: body || null,
      message_type: "promotion",
      is_global: false,
      status: "sent",
    }).select().single();

    const { data: customers } = await serviceClient
      .from("customers")
      .select("auth_user_id")
      .eq("store_user_id", user.id);

    if (!customers || customers.length === 0) {
      return json({ 
        sent: 0, 
        total_customers: 0, 
        customers_with_push: 0, 
        removed: 0, 
        message: "Nenhum cliente encontrado, mas a mensagem foi registrada no sistema." 
      });
    }

    // Get all unique customer auth_user_ids, EXCLUDING the store owner (admin)
    const customerUserIds = [...new Set(
      customers.map((c: any) => c.auth_user_id).filter((id: string) => !!id && id !== user.id)
    )];

    if (customerUserIds.length === 0) {
      return json({ 
        sent: 0, 
        total_customers: customers.length, 
        customers_with_push: 0, 
        removed: 0, 
        message: "Nenhum cliente com conta encontrado, mas a mensagem ficará visível no sino da loja." 
      });
    }

    // Get push subscriptions for these customers
    const { data: subs } = await serviceClient
      .from("push_subscriptions")
      .select("user_id, store_user_id")
      .in("user_id", customerUserIds);

    // Filter: keep subs where store_user_id matches this store OR is null
    const validSubs = (subs || []).filter(
      (s: any) => !s.store_user_id || s.store_user_id === user.id
    );

    const uniqueUserIds = [...new Set(validSubs.map((s: any) => s.user_id))];

    if (uniqueUserIds.length === 0) {
      return json({
        sent: 0,
        total_customers: customers.length,
        customers_with_push: 0,
        removed: 0,
        message: `Nenhum dos ${customers.length} cliente(s) ativou notificações push. A mensagem ficará disponível apenas no sino da loja.`,
      });
    }

    let sent = 0;
    let removed = 0;
    const failures: string[] = [];

    for (const targetUserId of uniqueUserIds) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_user_id: targetUserId,
            title,
            body: body || "",
            url: url || "/",
            type: "store_promotion",
            store_user_id: user.id,
          }),
        });

        const data = await resp.json();

        if (resp.ok) {
          sent += data.sent || 0;
          removed += data.removed || 0;
          if (!data.sent && !data.removed) {
            failures.push(targetUserId);
          }
        } else {
          failures.push(targetUserId);
        }
      } catch (_e: any) {
        failures.push(targetUserId);
      }
    }

    // Update message stats if we have the record
    if (msgRecord) {
      await serviceClient.from("tenant_messages").update({
        delivered_count: sent,
        failed_count: failures.length,
      }).eq("id", msgRecord.id);
    }

    return json({
      sent,
      total_customers: customers.length,
      customers_with_push: uniqueUserIds.length,
      removed,
      failures: failures.length,
    });
  } catch (error: any) {
    console.error("Send push to customers error:", error);
    return json({ error: error.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
