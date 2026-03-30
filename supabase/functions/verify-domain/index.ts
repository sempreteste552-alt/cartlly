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

    // Validate domain format
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "");
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
      return new Response(JSON.stringify({ error: "Invalid domain format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the store settings
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

    const expectedTxt = `lovable_verify=${settingsId.slice(0, 12)}`;

    let aRecordFound = false;
    let txtRecordFound = false;
    let nameservers: string[] = [];
    let detectedProvider = "other";

    // Provider detection map
    const providerMap: Record<string, string[]> = {
      hostinger: ["hostinger", "dns-parking"],
      godaddy: ["godaddy", "domaincontrol"],
      cloudflare: ["cloudflare"],
      registrobr: ["registro.br", "dns.br"],
      namecheap: ["namecheap", "registrar-servers"],
    };

    // NS lookup for provider detection
    try {
      const nsRes = await fetch(`https://dns.google/resolve?name=${cleanDomain}&type=NS`);
      const nsData = await nsRes.json();
      if (nsData.Answer) {
        nameservers = nsData.Answer.map((r: any) => (r.data || "").toLowerCase());
        for (const [provider, patterns] of Object.entries(providerMap)) {
          if (nameservers.some((ns: string) => patterns.some((p) => ns.includes(p)))) {
            detectedProvider = provider;
            break;
          }
        }
      }
    } catch (e) {
      console.error("NS lookup error:", e);
    }

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

    const dnsVerified = aRecordFound && txtRecordFound;
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
        provider: detectedProvider,
        nameservers,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
