import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// The main platform domain for CNAMEs
const RECOMMENDED_CNAME = "www.cartlly.lovable.app"; 

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

async function detectDnsProvider(hostname: string) {
  const domain = hostname.startsWith("www.") ? hostname.substring(4) : hostname;
  const nsData = await resolveDns(domain, "NS");
  
  if (!nsData.Answer) return "Desconhecido";
  
  const nsList = nsData.Answer.filter((r: any) => r.type === 2).map((r: any) => normalizeDnsValue(r.data));
  
  if (nsList.some((ns: string) => ns.includes("cloudflare.com"))) return "Cloudflare";
  if (nsList.some((ns: string) => ns.includes("hostinger.com"))) return "Hostinger";
  if (nsList.some((ns: string) => ns.includes("godaddy.com") || ns.includes("domaincontrol.com"))) return "GoDaddy";
  if (nsList.some((ns: string) => ns.includes("registro.br"))) return "Registro.br";
  if (nsList.some((ns: string) => ns.includes("google.com"))) return "Google Domains";
  if (nsList.some((ns: string) => ns.includes("aws.com") || ns.includes("awsdns"))) return "AWS Route53";
  if (nsList.some((ns: string) => ns.includes("namecheap.com"))) return "Namecheap";
  
  return nsList[0] || "Desconhecido";
}

async function registerCloudflareCustomHostname(hostname: string, tenantToken?: string, tenantZoneId?: string) {
  // Use tenant-specific credentials if available, otherwise fallback to global ones
  const token = tenantToken || Deno.env.get("CLOUDFLARE_API_TOKEN");
  const zoneId = tenantZoneId || Deno.env.get("CLOUDFLARE_ZONE_ID");

  if (!token || !zoneId) {
    console.log(`Cloudflare config missing for ${hostname}`);
    return { success: false, error: "Cloudflare configuration missing" };
  }

  try {
    console.log(`Registering Custom Hostname: ${hostname} (Zone: ${zoneId})`);
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostname: hostname,
          ssl: {
            method: "http",
            type: "dv",
            settings: {
              min_tls_version: "1.2",
              http2: "on"
            }
          },
        }),
      }
    );

    const data = await response.json();
    if (!data.success) {
      if (data.errors?.some((e: any) => e.code === 1406)) {
        return { success: true, already_exists: true };
      }
      return { success: false, error: data.errors?.[0]?.message || "Cloudflare API Error" };
    }

    return { success: true, data: data.result };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function checkHttps(domain: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    if (response.status >= 200 && response.status < 500) {
      return { ready: true, error: null };
    }
    return { ready: false, error: `Status ${response.status}` };
  } catch (error: any) {
    return { ready: false, error: error.message || "SSL not ready" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { settingsId, domain, domainId } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch domain record
    let { data: domainRecord, error: fetchErr } = await supabase
      .from("store_domains")
      .select("*")
      .eq(domainId ? "id" : "hostname", domainId || domain)
      .eq("store_id", settingsId)
      .maybeSingle();

    if (!domainRecord) {
      return new Response(JSON.stringify({ error: "Domain not found" }), { status: 404, headers: corsHeaders });
    }

    const hostname = domainRecord.hostname;
    const isWww = hostname.startsWith("www.");
    const apexDomain = isWww ? hostname.substring(4) : hostname;
    const verificationHost = `_lovable.${apexDomain}`;
    const verificationToken = domainRecord.verification_token;
    
    // 2. Provider Detection
    const provider = await detectDnsProvider(hostname);

    // 3. DNS Checks
    const dnsResults: any = {
      cname: { found: false, value: null, correct: false },
      txt: { found: false, value: [], correct: false },
      a_records: [],
      is_proxied: false,
      conflicts: [],
    };

    const cnameData = await resolveDns(hostname, "CNAME");
    if (cnameData.Answer) {
      const record = cnameData.Answer.find((r: any) => r.type === 5);
      if (record) {
        dnsResults.cname.found = true;
        dnsResults.cname.value = normalizeDnsValue(record.data);
        dnsResults.cname.correct = dnsResults.cname.value === RECOMMENDED_CNAME || dnsResults.cname.value.endsWith(".lovable.app");
      }
    }

    // Check A records for proxy detection (especially Cloudflare)
    const aData = await resolveDns(hostname, "A");
    if (aData.Answer) {
      dnsResults.a_records = aData.Answer.filter((r: any) => r.type === 1).map((r: any) => r.data);
      // Simple Cloudflare IP detection (not exhaustive, but good for common cases)
      dnsResults.is_proxied = dnsResults.a_records.some((ip: string) => 
        ip.startsWith("172.67.") || ip.startsWith("104.") || ip.startsWith("188.114.") || ip.startsWith("172.64.")
      );
    }

    const txtData = await resolveDns(verificationHost, "TXT");
    if (txtData.Answer) {
      const records = txtData.Answer.filter((r: any) => r.type === 16).map((r: any) => normalizeDnsValue(r.data));
      dnsResults.txt.found = records.length > 0;
      dnsResults.txt.correct = records.some((r: string) => r.includes(verificationToken) || r.includes("lovable_verify="));
    }

    // 4. Cloudflare Logic
    let cfResult = null;
    let sslResult = { ready: false, error: "Aguardando verificação DNS" };

    // Ownership is proven if EITHER CNAME is correct OR TXT is correct
    // For Cloudflare users with Proxy enabled, CNAME will be false but TXT should be true
    const ownershipVerified = dnsResults.txt.correct || dnsResults.cname.correct;

    if (ownershipVerified) {
      cfResult = await registerCloudflareCustomHostname(
        hostname, 
        domainRecord.cloudflare_api_token, 
        domainRecord.cloudflare_zone_id
      );
      sslResult = await checkHttps(hostname);
    }

    // 5. Calculate Statuses
    const txtStatus = dnsResults.txt.correct ? "verified" : "pending";
    
    // For DNS status, if it's Cloudflare and it's proxied, and ownership is verified, we consider it "propagated"
    const dnsStatus = dnsResults.cname.correct || (dnsResults.is_proxied && dnsResults.txt.correct) ? "propagated" : (dnsResults.cname.found ? "failed" : "pending");
    
    let sslStatus = "pending";
    if (sslResult.ready) sslStatus = "active";
    else if (ownershipVerified) sslStatus = "emitting";
    else if (sslResult.error && !sslResult.error.includes("Aguardando")) sslStatus = "failed";

    const finalStatus = sslStatus === "active" ? "active" : 
                       (sslStatus === "emitting" || ownershipVerified ? "pending_ssl" : "pending_dns");


    const updateData = {
      status: finalStatus,
      txt_status: txtStatus,
      dns_status: dnsStatus,
      ssl_status: sslStatus,
      detected_provider: provider,
      last_verified_at: new Date().toISOString(),
      dns_validation_details: dnsResults,
      ssl_validation_details: sslResult,
      last_ssl_error: sslResult.error,
    };

    await supabase.from("store_domains").update(updateData).eq("id", domainRecord.id);

    // Sync primary domain
    if (domainRecord.is_primary && finalStatus === "active") {
      await supabase.from("store_settings").update({
        custom_domain: hostname,
        domain_status: "verified"
      } as any).eq("id", settingsId);
    }

    return new Response(JSON.stringify({
      status: finalStatus,
      provider,
      dns: dnsResults,
      ssl: sslResult,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});