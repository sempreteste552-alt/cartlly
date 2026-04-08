import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGET_IP = "185.158.133.1";

function sanitizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

async function resolveDns(name: string, type: string) {
  const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
  return response.json();
}

async function checkHttps(domain: string) {
  try {
    const response = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "manual",
    });
    return response.status >= 200 && response.status < 400;
  } catch (_error) {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { settingsId, domain } = await req.json();
    const requestedDomain = sanitizeDomain(domain || "");

    if (!settingsId || !requestedDomain) {
      return new Response(JSON.stringify({ error: "Missing settingsId or domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(requestedDomain)) {
      return new Response(JSON.stringify({ error: "Invalid domain format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apexDomain = requestedDomain.replace(/^www\./, "");
    const aHosts = Array.from(new Set([requestedDomain, apexDomain].filter(Boolean)));
    const txtHosts = Array.from(
      new Set([
        `_lovable.${requestedDomain}`,
        `_lovable.${apexDomain}`,
      ].filter(Boolean)),
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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
    const checkedAHosts: Array<{ host: string; records: string[] }> = [];
    const checkedTxtHosts: Array<{ host: string; records: string[] }> = [];

    const providerMap: Record<string, string[]> = {
      hostinger: ["hostinger", "dns-parking"],
      godaddy: ["godaddy", "domaincontrol"],
      cloudflare: ["cloudflare"],
      registrobr: ["registro.br", "dns.br"],
      namecheap: ["namecheap", "registrar-servers"],
    };

    try {
      const nsData = await resolveDns(apexDomain, "NS");
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

    for (const host of aHosts) {
      try {
        const aData = await resolveDns(host, "A");
        const records = (aData.Answer || []).map((r: any) => String(r.data || ""));
        checkedAHosts.push({ host, records });
        if (records.some((record) => record === TARGET_IP)) {
          aRecordFound = true;
        }
      } catch (e) {
        console.error(`A record check error for ${host}:`, e);
      }
    }

    for (const host of txtHosts) {
      try {
        const txtData = await resolveDns(host, "TXT");
        const records = (txtData.Answer || []).map((r: any) => String(r.data || "").replace(/"/g, "").trim());
        checkedTxtHosts.push({ host, records });
        if (records.some((record) => record === expectedTxt)) {
          txtRecordFound = true;
        }
      } catch (e) {
        console.error(`TXT record check error for ${host}:`, e);
      }
    }

    const dnsVerified = aRecordFound && txtRecordFound;
    const sslReady = dnsVerified ? await checkHttps(requestedDomain) : false;
    const newStatus = sslReady ? "verified" : (dnsVerified || aRecordFound || txtRecordFound ? "pending" : "failed");

    const { error: updateError } = await supabase
      .from("store_settings")
      .update({
        domain_status: newStatus,
        domain_last_check: new Date().toISOString(),
        custom_domain: requestedDomain,
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
        sslReady,
        domain: requestedDomain,
        provider: detectedProvider,
        nameservers,
        checkedAHosts,
        checkedTxtHosts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
