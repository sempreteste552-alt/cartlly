
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
  const logisticId = data.orderId.replace(/-/g, "").slice(0, 20).toUpperCase();
  const fullAddress = buildFullAddress(data);
  const cep = data.shippingCep ? formatCep(data.shippingCep) : "";
  const itemsSummary = data.items
    .slice(0, 3)
    .map((i) => `${i.quantity}x ${i.name.substring(0, 35)}${i.variation ? ` (${i.variation})` : ""}`)
    .join(" | ");
  const carrier = data.shippingMethod || "PADRÃO";
  const serviceType = data.shippingType || "";
  const tracking = data.trackingCode || "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Etiqueta #${shortId}</title>
<style>
@page{size:100mm 150mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Courier New',Courier,monospace;width:100mm;height:150mm;padding:3mm;font-size:9px;line-height:1.3;color:#000;background:#fff}
.label{border:1.5pt solid #000;width:100%;height:100%;display:flex;flex-direction:column}

/* HEADER */
.hdr{display:flex;justify-content:space-between;align-items:center;padding:2mm 3mm;border-bottom:1.5pt solid #000}
.hdr-id{font-size:18px;font-weight:900;letter-spacing:1px}
.hdr-meta{text-align:right;font-size:7px;color:#333}
.hdr-meta b{font-size:8px;display:block}

/* DEST */
.dest{padding:2.5mm 3mm;border-bottom:1pt solid #000;flex:0 0 auto}
.dest-tag{font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#555;margin-bottom:1mm}
.dest-name{font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1mm}
.dest-addr{font-size:9px;line-height:1.45}
.dest-cep{font-size:22px;font-weight:900;letter-spacing:3px;margin-top:2mm;border:1.5pt solid #000;display:inline-block;padding:0.5mm 3mm}
.dest-phone{font-size:8px;margin-top:1.5mm;color:#333}

/* SENDER */
.sender{display:flex;justify-content:space-between;padding:2mm 3mm;border-bottom:1pt solid #000;font-size:8px}
.sender-tag{font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#555;margin-bottom:.5mm}
.sender-col{flex:1}
.sender-name{font-weight:700;font-size:9px;text-transform:uppercase}
.sender-info{color:#444}

/* ITEMS */
.items{padding:2mm 3mm;border-bottom:1pt solid #000;font-size:8px;flex:0 0 auto}
.items-tag{font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#555;margin-bottom:.5mm}
.items-list{font-size:8px;line-height:1.4}
.items-note{font-size:7px;color:#555;margin-top:1mm;font-style:italic}

/* SHIPPING */
.ship{display:flex;justify-content:space-between;padding:2mm 3mm;border-bottom:1pt solid #000;font-size:8px}
.ship-tag{font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#555;margin-bottom:.5mm}
.ship-carrier{font-weight:900;font-size:11px;text-transform:uppercase}
.ship-type{font-size:9px;font-weight:700}
.ship-tracking{font-family:monospace;font-size:9px;letter-spacing:1px;background:#eee;padding:1mm 2mm;margin-top:1mm;display:inline-block}

/* CODES */
.codes{flex:1;display:flex;align-items:stretch;min-height:30mm}
.codes-bar{flex:1.5;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2mm;border-right:1pt dashed #999}
.codes-bar svg{width:90%;max-height:35px}
.codes-bar-text{font-size:7px;letter-spacing:2px;margin-top:1mm;font-family:monospace}
.codes-qr{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2mm}
.codes-qr canvas{width:22mm;height:22mm}
.codes-qr-text{font-size:6px;color:#666;margin-top:1mm;text-align:center}

@media print{body{width:100mm;height:150mm}}
</style>
</head>
<body>
<div class="label">

  <div class="hdr">
    <div class="hdr-id">#${shortId}</div>
    <div class="hdr-meta">
      <b>${logisticId}</b>
      ${data.date}
    </div>
  </div>

  <div class="dest">
    <div class="dest-tag">DESTINATÁRIO</div>
    <div class="dest-name">${escapeHtml(data.customerName)}</div>
    <div class="dest-addr">${escapeHtml(fullAddress || "Endereço não informado")}</div>
    ${cep ? `<div class="dest-cep">${cep}</div>` : ""}
    ${data.customerPhone ? `<div class="dest-phone">TEL: ${escapeHtml(data.customerPhone)}</div>` : ""}
  </div>

  <div class="sender">
    <div class="sender-col">
      <div class="sender-tag">REMETENTE</div>
      <div class="sender-name">${escapeHtml(data.storeName)}</div>
      ${data.storeCity || data.storeState ? `<div class="sender-info">${[data.storeCity, data.storeState].filter(Boolean).join(" / ")}</div>` : ""}
      ${data.storeCep ? `<div class="sender-info">CEP ${formatCep(data.storeCep)}</div>` : ""}
    </div>
    ${data.storePhone ? `<div class="sender-info" style="text-align:right">TEL: ${escapeHtml(data.storePhone)}</div>` : ""}
  </div>

  <div class="items">
    <div class="items-tag">CONTEÚDO (${data.items.reduce((s, i) => s + i.quantity, 0)} itens)</div>
    <div class="items-list">${escapeHtml(itemsSummary)}</div>
    ${data.notes ? `<div class="items-note">OBS: ${escapeHtml(data.notes)}</div>` : ""}
  </div>

  <div class="ship">
    <div>
      <div class="ship-tag">ENVIO</div>
      <div class="ship-carrier">${escapeHtml(carrier)}</div>
      ${serviceType ? `<div class="ship-type">${escapeHtml(serviceType)}</div>` : ""}
    </div>
    <div style="text-align:right">
      ${tracking ? `<div class="ship-tracking">${escapeHtml(tracking)}</div>` : ""}
      ${data.estimatedDelivery ? `<div style="font-size:7px;margin-top:1mm;color:#555">Prazo: ${escapeHtml(data.estimatedDelivery)}</div>` : ""}
    </div>
  </div>

  <div class="codes">
    <div class="codes-bar">
      <svg id="barcode"></svg>
      <div class="codes-bar-text">${logisticId}</div>
    </div>
    <div class="codes-qr">
      <canvas id="qrcode"></canvas>
      <div class="codes-qr-text">SCAN P/ RASTREIO</div>
    </div>
  </div>

</div>

<script>
(function(){
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
  var t=${JSON.stringify(logisticId)};var b=enc(t);var svg=document.getElementById('barcode');
  if(svg){var x=0,u=1,h=35,r='';b.forEach(function(w,i){if(i%2===0)r+='<rect x="'+x+'" y="0" width="'+(w*u)+'" height="'+h+'" fill="#000"/>';x+=w*u});svg.setAttribute('viewBox','0 0 '+x+' '+h);svg.innerHTML=r}
})();
(function(){
  var c=document.getElementById('qrcode');if(!c)return;var x=c.getContext('2d'),s=120;c.width=s;c.height=s;
  var id=${JSON.stringify(data.orderId)},g=15,cs=s/g;
  x.fillStyle='#fff';x.fillRect(0,0,s,s);x.fillStyle='#000';
  function f(px,py){x.fillRect(px*cs,py*cs,7*cs,7*cs);x.fillStyle='#fff';x.fillRect((px+1)*cs,(py+1)*cs,5*cs,5*cs);x.fillStyle='#000';x.fillRect((px+2)*cs,(py+2)*cs,3*cs,3*cs)}
  f(0,0);f(g-7,0);f(0,g-7);
  var h=0;for(var i=0;i<id.length;i++)h=((h<<5)-h)+id.charCodeAt(i);
  for(var r=0;r<g;r++)for(var c2=0;c2<g;c2++){if((r<8&&c2<8)||(r<8&&c2>=g-8)||(r>=g-8&&c2<8))continue;if(((h>>((r*g+c2)%31))&1)===1)x.fillRect(c2*cs,r*cs,cs,cs)}
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
