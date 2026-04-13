
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
  const cep = data.shippingCep ? formatCep(data.shippingCep) : "";
  const carrier = data.shippingMethod || "Transportadora";
  const serviceType = data.shippingType || "Padrão";
  const tracking = data.trackingCode || logisticCode;
  
  const itemsTable = data.items
    .map((i, index) => `
      <tr>
        <td style="border: 1px solid #000; padding: 4px; text-align: center;">${index + 1}</td>
        <td style="border: 1px solid #000; padding: 4px;">${escapeHtml(i.name)}${i.variation ? ` (${escapeHtml(i.variation)})` : ""}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center;">Un</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center;">${i.quantity}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right;">R$ ${i.price.toFixed(2)}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right;">R$ ${(i.price * i.quantity).toFixed(2)}</td>
      </tr>
    `)
    .join("");

  const senderFullAddress = data.storeAddress || [data.storeCity, data.storeState].filter(Boolean).join(", ");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Etiqueta e Declaração #${shortId}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', Arial, sans-serif; background: #fff; color: #000; padding: 20px; }

/* === ETIQUETA === */
.label-container {
  width: 100mm;
  height: 150mm;
  border: 1px solid #000;
  padding: 10px;
  margin-bottom: 50px;
  display: flex;
  flex-direction: column;
  position: relative;
}

.label-header {
  display: flex;
  justify-content: space-between;
  border-bottom: 2px solid #000;
  padding-bottom: 5px;
  margin-bottom: 10px;
}

.label-header img { max-height: 40px; max-width: 120px; object-fit: contain; }
.label-header .carrier-info { text-align: right; }
.label-header .carrier-info h2 { font-size: 14px; font-weight: 900; }
.label-header .carrier-info p { font-size: 10px; font-weight: 700; text-transform: uppercase; }

.tracking-section {
  text-align: center;
  padding: 15px 0;
  border-bottom: 1px solid #000;
}
.barcode-svg { width: 100%; height: 60px; }
.tracking-number { font-size: 14px; font-weight: 800; letter-spacing: 2px; margin-top: 5px; font-family: 'Courier New', monospace; }

.recipient-section {
  padding: 10px 0;
  flex-grow: 1;
}
.section-title {
  font-size: 8px;
  font-weight: 900;
  text-transform: uppercase;
  background: #000;
  color: #fff;
  padding: 2px 5px;
  display: inline-block;
  margin-bottom: 5px;
}
.recipient-name { font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 5px; }
.recipient-address { font-size: 12px; line-height: 1.4; }
.recipient-address b { font-weight: 800; }

.cep-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 10px;
}
.cep-text { font-size: 28px; font-weight: 900; font-family: 'Courier New', monospace; letter-spacing: 1px; }
.city-state { font-size: 12px; font-weight: 700; text-transform: uppercase; }

.sender-section {
  border-top: 1px solid #000;
  padding-top: 10px;
  font-size: 9px;
}
.sender-details { line-height: 1.3; }

/* === DECLARAÇÃO DE CONTEÚDO === */
.declaration-container {
  width: 210mm;
  padding: 20px;
  font-size: 11px;
  border: 1px solid #000;
  background: #fff;
}
.declaration-title { text-align: center; font-size: 16px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }

.declaration-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
.declaration-box { border: 1px solid #000; padding: 8px; }
.box-header { font-weight: 800; text-transform: uppercase; font-size: 10px; margin-bottom: 5px; background: #f0f0f0; padding: 2px 5px; }

.items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
.items-table th { border: 1px solid #000; background: #f0f0f0; padding: 5px; font-size: 10px; text-transform: uppercase; }

.declaration-footer { margin-top: 20px; font-size: 10px; }
.declaration-footer p { margin-bottom: 10px; }
.signature-box { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
.signature-line { border-top: 1px solid #000; width: 250px; text-align: center; padding-top: 5px; }

@media print {
  body { padding: 0; }
  .label-container { page-break-after: always; border: 2pt solid #000; }
  .declaration-container { border: 2pt solid #000; }
}
</style>
</head>
<body>

  <!-- ETIQUETA DE ENVIO -->
  <div class="label-container">
    <div class="label-header">
      ${data.storeLogo ? `<img src="${escapeHtml(data.storeLogo)}" />` : `<div style="font-weight: 900; font-size: 18px;">${escapeHtml(data.storeName)}</div>`}
      <div class="carrier-info">
        <h2>${escapeHtml(carrier)}</h2>
        <p>${escapeHtml(serviceType)}</p>
      </div>
    </div>

    <div class="tracking-section">
      <svg id="barcode-label" class="barcode-svg"></svg>
      <div class="tracking-number">${escapeHtml(tracking)}</div>
    </div>

    <div class="recipient-section">
      <div class="section-title">Destinatário</div>
      <div class="recipient-name">${escapeHtml(data.customerName)}</div>
      <div class="recipient-address">
        ${data.shippingStreet ? `<b>${escapeHtml(data.shippingStreet)}, ${escapeHtml(data.shippingNumber || "S/N")}</b>` : `<b>${escapeHtml(data.customerAddress || "")}</b>`}
        ${data.shippingComplement ? `<br/>${escapeHtml(data.shippingComplement)}` : ""}
        ${data.shippingNeighborhood ? `<br/>Bairro: ${escapeHtml(data.shippingNeighborhood)}` : ""}
      </div>
      <div class="cep-section">
        <div class="city-state">${[data.shippingCity, data.shippingState].filter(Boolean).map(s => escapeHtml(s!)).join(" / ")}</div>
        <div class="cep-text">${cep}</div>
      </div>
    </div>

    <div class="sender-section">
      <div class="section-title" style="background: #fff; color: #000; border: 1px solid #000;">Remetente</div>
      <div class="sender-details">
        <strong>${escapeHtml(data.storeName)}</strong><br/>
        ${escapeHtml(senderFullAddress)} - CEP: ${data.storeCep ? formatCep(data.storeCep) : ""}
      </div>
    </div>
    
    <div style="position: absolute; bottom: 10px; right: 10px; font-size: 8px; color: #666;">
      Pedido #${shortId}
    </div>
  </div>

  <!-- DECLARAÇÃO DE CONTEÚDO -->
  <div class="declaration-container">
    <div class="declaration-title">Declaração de Conteúdo</div>
    
    <div class="declaration-grid">
      <div class="declaration-box">
        <div class="box-header">Remetente</div>
        <strong>Nome:</strong> ${escapeHtml(data.storeName)}<br/>
        <strong>Endereço:</strong> ${escapeHtml(senderFullAddress)}<br/>
        <strong>Cidade/UF:</strong> ${escapeHtml(data.storeCity || "")} / ${escapeHtml(data.storeState || "")}<br/>
        <strong>CEP:</strong> ${data.storeCep ? formatCep(data.storeCep) : ""}<br/>
        <strong>Email/Tel:</strong> ${escapeHtml(data.storeEmail || "")} / ${escapeHtml(data.storePhone || "")}
      </div>
      <div class="declaration-box">
        <div class="box-header">Destinatário</div>
        <strong>Nome:</strong> ${escapeHtml(data.customerName)}<br/>
        <strong>Endereço:</strong> ${data.shippingStreet ? `${escapeHtml(data.shippingStreet)}, ${escapeHtml(data.shippingNumber || "S/N")} ${escapeHtml(data.shippingComplement || "")}` : escapeHtml(data.customerAddress || "")}<br/>
        <strong>Bairro:</strong> ${escapeHtml(data.shippingNeighborhood || "")}<br/>
        <strong>Cidade/UF:</strong> ${escapeHtml(data.shippingCity || "")} / ${escapeHtml(data.shippingState || "")}<br/>
        <strong>CEP:</strong> ${cep}
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Conteúdo</th>
          <th>Unid.</th>
          <th>Qtd.</th>
          <th>Vlr. Unit.</th>
          <th>Vlr. Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsTable}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5" style="border: 1px solid #000; padding: 5px; text-align: right; font-weight: 800;">TOTAL</td>
          <td style="border: 1px solid #000; padding: 5px; text-align: right; font-weight: 800;">R$ ${data.total.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="declaration-footer">
      <div class="declaration-box" style="margin-bottom: 15px;">
        <div class="box-header">Declaração</div>
        <p>Declaro que não me enquadro no conceito de contribuinte previsto no art. 4º da Lei Complementar nº 87/1996, logo não estou obrigado à emissão de nota fiscal na operação e prestação que realizo, bem como que a mercadoria acima descrita é objeto de venda eventual, não caracterizando intuito comercial, e que os dados acima são a expressão da verdade.</p>
      </div>
      
      <p style="text-align: right; margin-top: 20px;">${escapeHtml(data.shippingCity || "")}, ${new Date().toLocaleDateString('pt-BR')}</p>
      
      <div class="signature-box">
        <div class="signature-line">Assinatura do Remetente</div>
        <div style="font-size: 9px; text-align: right; width: 300px;">
          <strong>Atenção:</strong> O remetente é responsável pelas informações declaradas. A falsidade desta declaração sujeita o infrator às sanções previstas em lei.
        </div>
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
  
  function drawBarcode(id, text) {
    var b=enc(text);
    var svg=document.getElementById(id);
    if(svg){
      var x=0,u=2,h=50,r='';
      b.forEach(function(w,i){
        if(i%2===0)r+='<rect x="'+x+'" y="0" width="'+(w*u)+'" height="'+h+'" fill="#000"/>';
        x+=w*u;
      });
      svg.setAttribute('viewBox','0 0 '+x+' '+h);
      svg.innerHTML=r;
    }
  }

  drawBarcode('barcode-label', ${JSON.stringify(tracking)});
})();
window.onload=function(){ setTimeout(function(){ window.print(); window.close(); }, 800); };
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
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCep(cep: string): string {
  if (!cep) return "";
  const clean = cep.replace(/\D/g, "");
  if (clean.length === 8) return clean.slice(0, 5) + "-" + clean.slice(5);
  return cep;
}
