import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { settingsId, domain } = await req.json();
    if (!settingsId || !domain) {
      return new Response(JSON.stringify({ error: "Missing settingsId or domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the store settings to get the verification token
    const { data: settings, error: settingsError } = await supabase
      .from("store_settings")
      .select("id, custom_domain, user_id")
      .eq("id", settingsId)
      .single();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: "Settings not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "");
    const expectedTxt = `lovable_verify=${settingsId.slice(0, 12)}`;

    let dnsVerified = false;
    let aRecordFound = false;
    let txtRecordFound = false;

    // Verify A record
    try {
      const aResponse = await fetch(`https://dns.google/resolve?name=${cleanDomain}&type=A`);
      const aData = await aResponse.json();
      if (aData.Answer) {
        aRecordFound = aData.Answer.some((r: any) => r.data === "185.158.133.1");
      }
    } catch (e) {
      console.error("A record check error:", e);
    }

    // Verify TXT record
    try {
      const txtResponse = await fetch(`https://dns.google/resolve?name=_lovable.${cleanDomain}&type=TXT`);
      const txtData = await txtResponse.json();
      if (txtData.Answer) {
        txtRecordFound = txtData.Answer.some((r: any) => {
          const val = (r.data || "").replace(/"/g, "").trim();
          return val === expectedTxt;
        });
      }
    } catch (e) {
      console.error("TXT record check error:", e);
    }

    dnsVerified = aRecordFound && txtRecordFound;

    const newStatus = dnsVerified ? "verified" : (aRecordFound || txtRecordFound ? "pending" : "failed");

    // Update domain status
    const { error: updateError } = await supabase
      .from("store_settings")
      .update({
        domain_status: newStatus,
        domain_last_check: new Date().toISOString(),
        custom_domain: domain,
      })
      .eq("id", settingsId);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        status: newStatus,
        aRecord: aRecordFound,
        txtRecord: txtRecordFound,
        domain: cleanDomain,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
