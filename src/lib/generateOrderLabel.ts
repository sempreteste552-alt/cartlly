
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
  const cep = data.shippingCep ? formatCep(data.shippingCep) : "";
  const carrier = data.shippingMethod || "Transportadora";
  const serviceType = data.shippingType || "Padrão";
  const tracking = data.trackingCode || "";
  const itemsSummary = data.items
    .map((i) => `${i.quantity}x ${i.name.substring(0, 40)}${i.variation ? ` (${i.variation})` : ""}`)
    .join("<br/>");

  const senderLocation = [data.storeCity, data.storeState].filter(Boolean).join(", ");
  const senderAddress = data.storeAddress || senderLocation;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Etiqueta de Envio #${shortId}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
@page { size: 100mm 150mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', Arial, sans-serif; width: 100mm; height: 150mm; padding: 0; font-size: 8px; line-height: 1.2; color: #000; background: #fff; }
.label { border: 2pt solid #000; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; }

/* === HEADER === */
.header { display: flex; border-bottom: 2pt solid #000; height: 25mm; }
.header-left { flex: 1.5; display: flex; flex-direction: column; justify-content: center; padding: 3mm; border-right: 1.5pt solid #000; }
.store-logo { max-height: 12mm; max-width: 35mm; object-fit: contain; margin-bottom: 1mm; }
.store-name { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; }

.header-right { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2mm; background: #000; color: #fff; }
.order-badge { font-size: 7px; font-weight: 700; text-transform: uppercase; opacity: 0.8; margin-bottom: 1mm; }
.order-id { font-size: 14px; font-weight: 900; letter-spacing: 1px; }

/* === SHIPPING INFO === */
.shipping-bar { display: flex; align-items: center; justify-content: space-between; background: #f0f0f0; padding: 2mm 4mm; border-bottom: 1.5pt solid #000; }
.carrier-name { font-size: 10px; font-weight: 900; text-transform: uppercase; }
.service-type { font-size: 8px; font-weight: 700; border: 1pt solid #000; padding: 0.5mm 1.5mm; border-radius: 2px; }

/* === BARCODE AREA === */
.barcode-section { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4mm; border-bottom: 2pt solid #000; flex: 0 0 auto; }
.barcode-container { width: 100%; display: flex; justify-content: center; margin-bottom: 1mm; }
.barcode-container svg { width: 90%; height: 15mm; }
.tracking-code { font-family: 'Courier New', monospace; font-size: 10px; font-weight: 900; letter-spacing: 3px; }

/* === RECIPIENT === */
.recipient-area { padding: 4mm; border-bottom: 1.5pt solid #000; flex: 1; position: relative; }
.tag { font-size: 6px; font-weight: 900; text-transform: uppercase; background: #000; color: #fff; padding: 0.5mm 1.5mm; margin-bottom: 2mm; display: inline-block; border-radius: 1px; }
.recipient-name { font-size: 14px; font-weight: 900; text-transform: uppercase; margin-bottom: 2mm; line-height: 1; }
.recipient-address { font-size: 10px; font-weight: 500; line-height: 1.4; color: #000; }
.recipient-address b { font-weight: 800; }

.cep-row { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 3mm; }
.cep-value { font-size: 24px; font-weight: 900; font-family: 'Courier New', monospace; letter-spacing: 2px; line-height: 1; }
.city-state { font-size: 10px; font-weight: 800; text-transform: uppercase; }

/* === SENDER === */
.sender-area { padding: 3mm 4mm; border-bottom: 1pt solid #000; background: #fafafa; }
.sender-label { font-size: 6px; font-weight: 800; color: #666; margin-bottom: 1mm; text-transform: uppercase; }
.sender-info { display: flex; justify-content: space-between; align-items: flex-start; }
.sender-details { font-size: 8px; line-height: 1.3; }
.sender-name { font-weight: 900; }
.sender-cep { font-weight: 900; font-size: 10px; font-family: 'Courier New', monospace; }

/* === CONTENT === */
.content-area { padding: 3mm 4mm; flex: 0 0 auto; min-height: 20mm; }
.content-label { font-size: 6px; font-weight: 800; color: #666; margin-bottom: 1.5mm; text-transform: uppercase; }
.items-list { font-size: 8px; line-height: 1.4; color: #333; }
.notes { margin-top: 2mm; padding-top: 1mm; border-top: 0.5pt dashed #ccc; font-style: italic; font-size: 7px; color: #666; }

/* === FOOTER === */
.footer { padding: 2mm; font-size: 6px; text-align: center; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }

@media print {
  body { width: 100mm; height: 150mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .label { page-break-inside: avoid; }
}
</style>
</head>
<body>
<div class="label">
  <div class="header">
    <div class="header-left">
      ${data.storeLogo ? `<img src="${escapeHtml(data.storeLogo)}" class="store-logo" />` : `<div class="store-name">${escapeHtml(data.storeName)}</div>`}
      <div style="font-size: 7px; color: #666; margin-top: 1mm;">${escapeHtml(data.storeEmail || "")}</div>
    </div>
    <div class="header-right">
      <div class="order-badge">Pedido</div>
      <div class="order-id">#${escapeHtml(shortId)}</div>
      <div style="font-size: 6px; opacity: 0.7; margin-top: 1mm;">${escapeHtml(data.date)}</div>
    </div>
  </div>

  <div class="shipping-bar">
    <div class="carrier-name">${escapeHtml(carrier)}</div>
    <div class="service-type">${escapeHtml(serviceType)}</div>
  </div>

  <div class="barcode-section">
    <div class="barcode-container">
      <svg id="barcode"></svg>
    </div>
    <div class="tracking-code">${escapeHtml(tracking || logisticCode)}</div>
  </div>

  <div class="recipient-area">
    <div class="tag">Destinatário</div>
    <div class="recipient-name">${escapeHtml(data.customerName)}</div>
    <div class="recipient-address">
      ${data.shippingStreet ? `<b>${escapeHtml(data.shippingStreet)}, ${escapeHtml(data.shippingNumber || "S/N")}</b>` : `<b>${escapeHtml(data.customerAddress || "")}</b>`}
      ${data.shippingComplement ? `<br/>${escapeHtml(data.shippingComplement)}` : ""}
      ${data.shippingNeighborhood ? `<br/>Bairro: ${escapeHtml(data.shippingNeighborhood)}` : ""}
      ${data.customerPhone ? `<br/>Tel: ${escapeHtml(data.customerPhone)}` : ""}
    </div>
    <div class="cep-row">
      <div class="city-state">${[data.shippingCity, data.shippingState].filter(Boolean).map(s => escapeHtml(s!)).join(" / ")}</div>
      <div class="cep-value">${cep}</div>
    </div>
  </div>

  <div class="sender-area">
    <div class="sender-label">Remetente</div>
    <div class="sender-info">
      <div class="sender-details">
        <div class="sender-name">${escapeHtml(data.storeName)}</div>
        <div>${escapeHtml(senderAddress)}</div>
      </div>
      <div class="sender-cep">${data.storeCep ? formatCep(data.storeCep) : ""}</div>
    </div>
  </div>

  <div class="content-area">
    <div class="content-label">Conteúdo do Pacote</div>
    <div class="items-list">${itemsSummary}</div>
    ${data.notes ? `<div class="notes">Obs: ${escapeHtml(data.notes)}</div>` : ""}
  </div>

  <div class="footer">
    Documento para fins de transporte. Gerado eletronicamente.
  </div>
</div>

<script>
(function(){
  // === Improved CODE128B Barcode Generation ===
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
    [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1]
  ]};
  function enc(t){
    var c=[],s=104;
    for(var i=0;i<t.length;i++){
      var v=t.charCodeAt(i)-32;
      if(v<0||v>94)v=0;
      c.push(v);
      s+=v*(i+1);
    }
    c.push(s%103);
    var b=C.START.slice();
    c.forEach(function(x){ b=b.concat(C.P[x]); });
    return b.concat(C.STOP);
  }
  var code = ${JSON.stringify(tracking || logisticCode)};
  var b=enc(code);
  var svg=document.getElementById('barcode');
  if(svg){
    var x=0,u=2,h=50,r='';
    b.forEach(function(w,i){
      if(i%2===0)r+='<rect x="'+x+'" y="0" width="'+(w*u)+'" height="'+h+'" fill="#000"/>';
      x+=w*u;
    });
    svg.setAttribute('viewBox','0 0 '+x+' '+h);
    svg.innerHTML=r;
  }
})();
window.onload=function(){ setTimeout(function(){ window.print(); window.close(); }, 500); };
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
