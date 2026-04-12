import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_EDGE_CNAME = "edge.lovableproject.com";

async function resolveDns(name: string, type: string) {
  try {
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
    return await response.json();
  } catch (e) {
    console.error(`DNS Resolution Error (${type} for ${name}):`, e);
    return {};
  }
}

function normalizeDnsValue(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "").replace(/"/g, "");
}

async function checkHttps(domain: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (response.status >= 200 && response.status < 500) {
      return { ready: true, error: null };
    }
    return { ready: false, error: `Status ${response.status} returned` };
  } catch (error: any) {
    return { ready: false, error: error.message || "SSL certificate not active or unreachable" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { settingsId, domain, domainId } = await req.json();
    if (!settingsId || (!domain && !domainId)) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch domain record
    let domainRecord;
    if (domainId) {
      const { data } = await supabase.from("store_domains").select("*").eq("id", domainId).single();
      domainRecord = data;
    } else {
      const { data } = await supabase.from("store_domains").select("*").eq("store_id", settingsId).eq("hostname", domain).single();
      domainRecord = data;
    }

    if (!domainRecord) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hostname = domainRecord.hostname;
    const isWww = hostname.startsWith("www.");
    const apexDomain = isWww ? hostname.substring(4) : hostname;
    const wwwDomain = isWww ? hostname : `www.${apexDomain}`;
    
    // We strictly enforce/recommend www for the CNAME
    const targetHost = wwwDomain;
    const verificationHost = `_lovable.${apexDomain}`;
    const verificationToken = domainRecord.verification_token;
    const expectedTxt = `lovable_verify=${verificationToken}`;

    // 2. Perform DNS Checks
    const dnsResults: any = {
      cname: { found: false, value: null, correct: false },
      txt: { found: false, value: [], correct: false },
      conflicts: [],
    };

    // A. Check CNAME for wwwDomain
    const cnameData = await resolveDns(targetHost, "CNAME");
    if (cnameData.Answer) {
      const record = cnameData.Answer.find((r: any) => r.type === 5);
      if (record) {
        dnsResults.cname.found = true;
        dnsResults.cname.value = normalizeDnsValue(record.data);
        dnsResults.cname.correct = dnsResults.cname.value === LOVABLE_EDGE_CNAME;
      }
    }

    // B. Check TXT for verification
    const txtData = await resolveDns(verificationHost, "TXT");
    if (txtData.Answer) {
      const records = txtData.Answer.filter((r: any) => r.type === 16).map((r: any) => normalizeDnsValue(r.data));
      dnsResults.txt.found = records.length > 0;
      dnsResults.txt.value = records;
      dnsResults.txt.correct = records.some((r: string) => r.includes(expectedTxt));
    }

    // C. Check for conflicts on Apex domain (A records pointing elsewhere)
    const apexAData = await resolveDns(apexDomain, "A");
    if (apexAData.Answer) {
      const aRecords = apexAData.Answer.filter((r: any) => r.type === 1).map((r: any) => r.data);
      if (aRecords.length > 0) {
        dnsResults.conflicts.push({
          type: "A",
          host: apexDomain,
          values: aRecords,
          message: "Encontramos um apontamento A no domínio raiz que pode impedir a emissão do SSL.",
        });
      }
    }

    // 3. SSL Check (only if DNS/TXT are good)
    let sslResult = { ready: false, error: "Aguardando verificação DNS e TXT" };
    if (dnsResults.cname.correct && dnsResults.txt.correct) {
      sslResult = await checkHttps(targetHost);
    }

    // 4. Update Statuses
    // Verification status
    const txtStatus = dnsResults.txt.correct ? "verified" : "pending";
    
    // DNS status
    let dnsStatus = "pending";
    if (dnsResults.cname.correct) {
      dnsStatus = dnsResults.conflicts.length > 0 ? "conflict" : "propagated";
    } else if (dnsResults.cname.found) {
      dnsStatus = "failed"; // Found but incorrect
    }

    // SSL status
    let sslStatus = "pending";
    if (sslResult.ready) {
      sslStatus = "active";
    } else if (dnsStatus === "propagated" && txtStatus === "verified") {
      sslStatus = "emitting";
    } else if (sslResult.error && sslResult.error !== "Aguardando verificação DNS e TXT") {
      sslStatus = "failed";
    }

    // Final Domain Status
    let finalStatus = "pending_dns";
    if (sslStatus === "active") finalStatus = "active";
    else if (sslStatus === "emitting") finalStatus = "pending_ssl";
    else if (txtStatus === "verified" && dnsStatus === "propagated") finalStatus = "pending_ssl";
    else if (txtStatus === "verified") finalStatus = "pending_dns";

    const updateData = {
      status: finalStatus,
      txt_status: txtStatus,
      dns_status: dnsStatus,
      ssl_status: sslStatus,
      last_verified_at: new Date().toISOString(),
      dns_validation_details: dnsResults,
      ssl_validation_details: sslResult,
      conflicting_records: dnsResults.conflicts,
      last_ssl_error: sslResult.error,
    };

    await supabase.from("store_domains").update(updateData).eq("id", domainRecord.id);

    // Sync with store_settings if primary
    if (domainRecord.is_primary && finalStatus === "active") {
      await supabase.from("store_settings").update({
        custom_domain: hostname,
        domain_status: "verified"
      }).eq("id", settingsId);
    }

    return new Response(
      JSON.stringify({
        status: finalStatus,
        dns: dnsResults,
        ssl: sslResult,
        txtStatus,
        dnsStatus,
        sslStatus
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});