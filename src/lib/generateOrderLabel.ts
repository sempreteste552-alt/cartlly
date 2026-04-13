
interface OrderLabelItem {
  name: string;
  quantity: number;
  variation?: string;
  price: number;
}

interface OrderLabelData {
  orderId: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  customerCpf?: string;
  customerEmail?: string;
  customerAddress?: string;
  shippingStreet?: string;
  shippingNumber?: string;
  shippingComplement?: string;
  shippingNeighborhood?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingCep?: string;
  storeName: string;
  storeLogo?: string;
  storeCity?: string;
  storeState?: string;
  storePhone?: string;
  storeEmail?: string;
  storeCep?: string;
  storeAddress?: string;
  items: OrderLabelItem[];
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
  shippingMethod?: string;
  shippingType?: string;
  trackingCode?: string;
  estimatedDelivery?: string;
  shippingCost?: number;
}

export function generateOrderLabel(data: OrderLabelData): void {
  const shortId = data.orderId.slice(0, 8).toUpperCase();
  const logisticCode = "PLP:" + data.orderId.replace(/-/g, "").slice(0, 10).toUpperCase();
  const contractCode = "CMP" + data.orderId.replace(/-/g, "").slice(0, 14).toUpperCase();
  const fullAddress = buildFullAddress(data);
  const cep = data.shippingCep ? formatCep(data.shippingCep) : "";
  const rawCep = data.shippingCep?.replace(/\D/g, "") || "";
  const carrier = data.shippingMethod || "Transportadora";
  const serviceType = data.shippingType || "";
  const tracking = data.trackingCode || "";
  const itemsSummary = data.items
    .slice(0, 3)
    .map((i) => `${i.quantity}x ${i.name.substring(0, 30)}${i.variation ? ` (${i.variation})` : ""}`)
    .join(" | ");

  const senderLocation = [data.storeCity, data.storeState].filter(Boolean).join(", ");
  const senderAddress = data.storeAddress || senderLocation;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Etiqueta #${shortId}</title>
<style>
@page{size:100mm 150mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;width:100mm;height:150mm;padding:0;font-size:8px;line-height:1.25;color:#000;background:#fff}
.label{border:1.5pt solid #000;width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden}

/* === HEADER === */
.header{display:flex;align-items:stretch;border-bottom:1.5pt solid #000;min-height:18mm}
.header-left{flex:1;display:flex;align-items:center;padding:2mm 3mm;border-right:1pt solid #000}
.header-left .logo-area{display:flex;align-items:center;gap:2mm}
.header-left .logo-area img{max-height:10mm;max-width:20mm}
.header-left .logo-text{font-size:14px;font-weight:900;letter-spacing:-.5px}
.header-center{flex:1.2;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5mm;border-right:1pt solid #000}
.header-center canvas{width:16mm;height:16mm}
.header-right{flex:1;display:flex;flex-direction:column;justify-content:center;padding:2mm 3mm;font-size:7px}
.header-right .plp{font-weight:700;font-size:8px}

/* === BARCODE AREA === */
.barcode-area{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2mm 5mm;border-bottom:1.5pt solid #000;min-height:16mm}
.barcode-area svg{width:85%;max-height:14mm}
.barcode-text{font-size:9px;font-weight:700;letter-spacing:2px;font-family:'Courier New',monospace;margin-top:1mm}

/* === CONTRACT LINE === */
.contract-line{display:flex;justify-content:space-between;padding:1.5mm 3mm;border-bottom:1pt solid #000;font-size:7px;background:#f5f5f5}
.contract-line b{font-size:8px}

/* === RECIPIENT === */
.recipient{padding:2.5mm 3mm;border-bottom:1.5pt solid #000;flex:0 0 auto}
.section-label{font-size:6px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#666;margin-bottom:.5mm}
.recipient-tag{display:flex;align-items:center;gap:2mm;margin-bottom:1.5mm;padding-bottom:1mm;border-bottom:1pt solid #ddd}
.recipient-tag span{font-size:7px;font-weight:900;text-transform:uppercase;letter-spacing:1px;background:#000;color:#fff;padding:.5mm 2mm;display:inline-block}
.recipient-name{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.3px;margin-bottom:1mm}
.recipient-addr{font-size:9px;line-height:1.5}
.recipient-addr div{margin-bottom:.3mm}
.recipient-cep-row{display:flex;align-items:center;justify-content:space-between;margin-top:2mm}
.recipient-cep{font-size:20px;font-weight:900;letter-spacing:4px;font-family:'Courier New',monospace}
.recipient-city{font-size:10px;font-weight:700;text-transform:uppercase}

/* === SENDER === */
.sender{padding:2mm 3mm;border-bottom:1pt solid #000;font-size:7.5px}
.sender-row{display:flex;justify-content:space-between;align-items:flex-start}
.sender-name{font-weight:700;font-size:8px}
.sender-addr{color:#333;font-size:7px;line-height:1.4}
.sender-cep{font-weight:900;font-size:12px;letter-spacing:2px;font-family:'Courier New',monospace;text-align:right}

/* === ITEMS === */
.items{padding:1.5mm 3mm;border-bottom:1pt solid #000;font-size:7px}
.items-content{font-size:7.5px;line-height:1.3;color:#222}

/* === SHIPPING INFO === */
.shipping{display:flex;justify-content:space-between;align-items:center;padding:1.5mm 3mm;border-bottom:1pt solid #000;font-size:7.5px}
.shipping-carrier{font-weight:900;font-size:10px;text-transform:uppercase}
.shipping-type{font-size:8px;font-weight:700}
.shipping-tracking{font-family:'Courier New',monospace;font-size:8px;letter-spacing:1px;background:#eee;padding:.5mm 2mm}

/* === FOOTER NOTICE === */
.footer-notice{padding:1.5mm 3mm;font-size:5.5px;color:#888;text-align:center;line-height:1.3}

@media print{
  body{width:100mm;height:150mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .label{page-break-inside:avoid}
}
</style>
</head>
<body>
<div class="label">

  <!-- HEADER: Logo + QR + Order ID -->
  <div class="header">
    <div class="header-left">
      <div class="logo-area">
        ${data.storeLogo ? `<img src="${escapeHtml(data.storeLogo)}" alt="Logo" />` : `<span class="logo-text">${escapeHtml(data.storeName)}</span>`}
      </div>
    </div>
    <div class="header-center">
      <canvas id="qrcode"></canvas>
    </div>
    <div class="header-right">
      <div>Pedido:</div>
      <div class="plp">${escapeHtml(shortId)}</div>
      <div style="margin-top:1mm">${escapeHtml(logisticCode)}</div>
    </div>
  </div>

  <!-- BARCODE -->
  <div class="barcode-area">
    <svg id="barcode"></svg>
    <div class="barcode-text">${escapeHtml(contractCode)}</div>
  </div>

  <!-- CONTRACT LINE -->
  <div class="contract-line">
    <div>Contrato: <b>${escapeHtml(contractCode)}</b></div>
    <div>${escapeHtml(data.date)}</div>
  </div>

  <!-- RECIPIENT -->
  <div class="recipient">
    <div class="recipient-tag">
      <span>DESTINATÁRIO</span>
      ${carrier ? `<span style="background:#555">${escapeHtml(carrier)}${serviceType ? ` / ${escapeHtml(serviceType)}` : ""}</span>` : ""}
    </div>
    <div class="recipient-name">${escapeHtml(data.customerName)}</div>
    <div class="recipient-addr">
      ${data.shippingStreet ? `<div>${escapeHtml(data.shippingStreet)}${data.shippingNumber ? `, ${escapeHtml(data.shippingNumber)}` : ""}</div>` : ""}
      ${data.shippingComplement ? `<div>${escapeHtml(data.shippingComplement)}</div>` : ""}
      ${data.shippingNeighborhood ? `<div>${escapeHtml(data.shippingNeighborhood)}</div>` : ""}
      ${!data.shippingStreet && data.customerAddress ? `<div>${escapeHtml(data.customerAddress)}</div>` : ""}
    </div>
    <div class="recipient-cep-row">
      <div class="recipient-city">${[data.shippingCity, data.shippingState].filter(Boolean).map(s => escapeHtml(s!)).join(" - ")}</div>
      ${cep ? `<div class="recipient-cep">${cep}</div>` : ""}
    </div>
    ${data.customerPhone ? `<div style="font-size:7px;color:#555;margin-top:1mm">Tel: ${escapeHtml(data.customerPhone)}</div>` : ""}
  </div>

  <!-- SENDER -->
  <div class="sender">
    <div class="section-label">REMETENTE</div>
    <div class="sender-row">
      <div>
        <div class="sender-name">${escapeHtml(data.storeName)}</div>
        <div class="sender-addr">${escapeHtml(senderAddress)}</div>
      </div>
      ${data.storeCep ? `<div class="sender-cep">${formatCep(data.storeCep)}</div>` : ""}
    </div>
  </div>

  <!-- ITEMS -->
  <div class="items">
    <div class="section-label">CONTEÚDO (${data.items.reduce((s, i) => s + i.quantity, 0)} ${data.items.reduce((s, i) => s + i.quantity, 0) === 1 ? "item" : "itens"})</div>
    <div class="items-content">${escapeHtml(itemsSummary)}</div>
    ${data.notes ? `<div style="font-size:6.5px;color:#666;margin-top:.5mm;font-style:italic">OBS: ${escapeHtml(data.notes)}</div>` : ""}
  </div>

  <!-- SHIPPING -->
  ${tracking ? `
  <div class="shipping">
    <div>
      <div class="shipping-carrier">${escapeHtml(carrier)}</div>
      ${serviceType ? `<div class="shipping-type">${escapeHtml(serviceType)}</div>` : ""}
    </div>
    <div class="shipping-tracking">${escapeHtml(tracking)}</div>
  </div>` : ""}

  <!-- FOOTER -->
  <div class="footer-notice">
    Etiqueta gerada automaticamente. Documento sem valor fiscal. Proibida a violação desta embalagem.
  </div>

</div>

<script>
(function(){
  // === CODE128B Barcode ===
  var C={START:[2,1,1,4,1,2],STOP:[2,3,3,1,1,1,2],P:[
[2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
[1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
[2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
[1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
[2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
[3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
[2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
[1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
[2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
[1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
[2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
[3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
[3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
[1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
[1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
[2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
[1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],
[1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
[2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],
[1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
[1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1]]};
  function enc(t){var c=[],s=104;for(var i=0;i<t.length;i++){var v=t.charCodeAt(i)-32;if(v<0||v>94)v=0;c.push(v);s+=v*(i+1)}c.push(s%103);var b=C.START.slice();c.forEach(function(x){b=b.concat(C.P[x])});return b.concat(C.STOP)}
  var t=${JSON.stringify(contractCode)};var b=enc(t);var svg=document.getElementById('barcode');
  if(svg){var x=0,u=1,h=40,r='';b.forEach(function(w,i){if(i%2===0)r+='<rect x="'+x+'" y="0" width="'+(w*u)+'" height="'+h+'" fill="#000"/>';x+=w*u});svg.setAttribute('viewBox','0 0 '+x+' '+h);svg.innerHTML=r}
})();
(function(){
  // === QR Code (simplified pattern) ===
  var c=document.getElementById('qrcode');if(!c)return;var x=c.getContext('2d'),s=120;c.width=s;c.height=s;
  var id=${JSON.stringify(data.orderId)},g=21,cs=s/g;
  x.fillStyle='#fff';x.fillRect(0,0,s,s);x.fillStyle='#000';
  function f(px,py){x.fillRect(px*cs,py*cs,7*cs,7*cs);x.fillStyle='#fff';x.fillRect((px+1)*cs,(py+1)*cs,5*cs,5*cs);x.fillStyle='#000';x.fillRect((px+2)*cs,(py+2)*cs,3*cs,3*cs)}
  f(0,0);f(g-7,0);f(0,g-7);
  // Alignment pattern
  x.fillRect(g-9+4,g-9+4,1,1);
  // Timing
  for(var i=8;i<g-8;i++){if(i%2===0){x.fillRect(i*cs,6*cs,cs,cs);x.fillRect(6*cs,i*cs,cs,cs)}}
  // Data
  var h=0;for(var i=0;i<id.length;i++)h=((h<<5)-h)+id.charCodeAt(i);
  for(var r=0;r<g;r++)for(var c2=0;c2<g;c2++){if((r<9&&c2<9)||(r<9&&c2>=g-8)||(r>=g-8&&c2<9))continue;if(r===6||c2===6)continue;if(((h>>((r*g+c2)%31))&1)===1)x.fillRect(c2*cs,r*cs,cs,cs)}
})();
window.onload=function(){setTimeout(function(){window.print()},400)};
</script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCep(cep: string): string {
  const clean = cep.replace(/\D/g, "");
  if (clean.length === 8) return clean.slice(0, 5) + "-" + clean.slice(5);
  return cep;
}

function buildFullAddress(data: OrderLabelData): string {
  if (data.shippingStreet) {
    const parts = [
      data.shippingStreet,
      data.shippingNumber ? `nº ${data.shippingNumber}` : "",
      data.shippingComplement || "",
      data.shippingNeighborhood || "",
      [data.shippingCity, data.shippingState].filter(Boolean).join("/"),
    ].filter(Boolean);
    return parts.join(", ");
  }
  return data.customerAddress || "";
}
