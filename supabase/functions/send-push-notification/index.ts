import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import webpush from "https://esm.sh/web-push@3.6.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { notification_id } = await req.json();

    // Get notification details
    const { data: notification, error: notificationError } = await supabaseClient
      .from("customer_notifications")
      .select("*, customers(*)")
      .eq("id", notification_id)
      .single();

    if (notificationError || !notification) {
      throw new Error(`Notification not found: ${notificationError?.message}`);
    }

    const customer_id = notification.customer_id;
    const auth_user_id = notification.customers.auth_user_id;

    // Get push subscriptions for this user
    const { data: subscriptions, error: subscriptionsError } = await supabaseClient
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", auth_user_id);

    if (subscriptionsError) {
      throw new Error(`Error fetching subscriptions: ${subscriptionsError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No push subscriptions found for user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Configure web-push
    webpush.setVapidDetails(
      "mailto:suporte@loja.com",
      Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
      Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
    );

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      data: notification.data,
      icon: "https://vgmhytguzstbiygksfxt.supabase.co/storage/v1/object/public/store-assets/notification-icon.png", // Generic icon
    });

    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };
          await webpush.sendNotification(pushSubscription, payload);
          return { endpoint: sub.endpoint, success: true };
        } catch (error) {
          console.error(`Error sending to ${sub.endpoint}:`, error);
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expired or no longer valid
            await supabaseClient.from("push_subscriptions").delete().eq("id", sub.id);
          }
          return { endpoint: sub.endpoint, success: false, error: error.message };
        }
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
