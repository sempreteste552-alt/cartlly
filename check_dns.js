
import dns from 'node:dns/promises';

async function checkDomain() {
  const domains = ['www.usebella.store', 'usebella.store'];
  for (const domain of domains) {
    console.log(`Checking ${domain}:`);
    try {
      const a = await dns.resolve4(domain);
      console.log('  A Records:', a);
    } catch (e) { console.log(`  A Records: Error (${e.message})`); }

    try {
      const cname = await dns.resolveCname(domain);
      console.log('  CNAME Records:', cname);
    } catch (e) { console.log(`  CNAME Records: Error (${e.message})`); }

    try {
      const txt = await dns.resolveTxt(domain);
      console.log('  TXT Records:', txt);
    } catch (e) { console.log(`  TXT Records: Error (${e.message})`); }
  }
}

checkDomain();
