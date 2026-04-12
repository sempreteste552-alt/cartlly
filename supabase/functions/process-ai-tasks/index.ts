import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch pending tasks that should have run by now
    const { data: tasks, error: tasksError } = await supabase
      .from("ai_scheduled_tasks")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .limit(10);

    if (tasksError) throw tasksError;

    const results = [];

    for (const task of (tasks || [])) {
      try {
        await supabase.from("ai_scheduled_tasks").update({ status: "processing" }).eq("id", task.id);

        if (task.task_type === "send_push") {
          // Send push to all customers of this store
          const { data: customers } = await supabase
            .from("customers")
            .select("id, auth_user_id")
            .eq("store_user_id", task.user_id);

          if (customers && customers.length > 0) {
            for (const customer of customers) {
              const { data: tokens } = await supabase
                .from("push_subscriptions")
                .select("*")
                .eq("user_id", customer.auth_user_id);

              if (tokens && tokens.length > 0) {
                for (const token of tokens) {
                  await supabase.functions.invoke("send-push-internal", {
                    body: {
                      target_user_id: customer.auth_user_id,
                      customer_id: customer.id,
                      title: task.payload.title,
                      body: task.payload.body || task.payload.description || "",
                      type: "ceo_insight",
                      store_user_id: task.user_id
                    }
                  });
                }
              }
            }
          }
        } else if (task.task_type === "admin_reminder" || task.task_type === "reminder") {
          // Send push DIRECTLY TO THE OWNER (task.user_id)
          await supabase.functions.invoke("send-push-internal", {
            body: {
              target_user_id: task.user_id,
              title: task.payload.title,
              body: task.payload.body || task.payload.description || "",
              type: "ceo_insight",
              store_user_id: task.user_id
            }
          });
          
          // Also update the specific reminder table if it exists
          try {
            await supabase.from("store_ai_reminders")
              .update({ status: "sent" })
              .eq("user_id", task.user_id)
              .eq("title", task.payload.title)
              .eq("status", "pending");
          } catch (e) {
            // Silently ignore if table doesn't exist
          }
        }

        await supabase.from("ai_scheduled_tasks").update({ status: "completed" }).eq("id", task.id);
        results.push({ id: task.id, status: "completed" });

      } catch (e) {
        console.error(`Error processing task ${task.id}:`, e);
        await supabase.from("ai_scheduled_tasks").update({ 
          status: "failed", 
          error_message: e.message 
        }).eq("id", task.id);
        results.push({ id: task.id, status: "failed", error: e.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Worker error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});