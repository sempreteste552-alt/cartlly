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

    // Get all customers of this store
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: customers } = await serviceClient
      .from("customers")
      .select("auth_user_id")
      .eq("store_user_id", user.id);

    if (!customers || customers.length === 0) {
      return json({ sent: 0, total: 0, message: "Nenhum cliente encontrado" });
    }

    const customerUserIds = customers.map((c: any) => c.auth_user_id).filter(Boolean);
    
    if (customerUserIds.length === 0) {
      return json({ sent: 0, total: 0, message: "Nenhum cliente com conta encontrado" });
    }

    // Get all push subscriptions for these customer user IDs
    const { data: subs } = await serviceClient
      .from("push_subscriptions")
      .select("user_id")
      .in("user_id", customerUserIds);

    const uniqueUserIds = [...new Set((subs || []).map((s: any) => s.user_id))];

    let sent = 0;
    const failures: string[] = [];

    // Send push to each customer via send-push-internal
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
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          sent += data.sent || 0;
        } else {
          failures.push(targetUserId);
        }
      } catch (e: any) {
        failures.push(targetUserId);
      }
    }

    return json({
      sent,
      total_customers: customers.length,
      customers_with_push: uniqueUserIds.length,
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
