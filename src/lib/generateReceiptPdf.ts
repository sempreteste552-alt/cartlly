interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

interface ReceiptData {
  orderId: string;
  date: string;
  storeName: string;
  storeLogoUrl?: string;
  storeAddress?: string;
  storePhone?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCpf?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  paymentMethod: string;
  notes?: string;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

export function generateReceiptPdf(data: ReceiptData): void {
  const cleanCpf = data.customerCpf?.replace(/\D/g, "") || "";
  const maskedCpf = cleanCpf.length === 11 
    ? `***.***.${cleanCpf.slice(7, 9)}-${cleanCpf.slice(9)}` 
    : data.customerCpf || "—";
    
  const authenticationCode = (data.orderId.replace(/-/g, "").toUpperCase() + "BANKTRANS" + Date.now().toString(36).toUpperCase()).slice(0, 32);

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Nota Fiscal - Pedido #${data.orderId.slice(0, 8)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', sans-serif; 
      color: #000; 
      padding: 10px;
      background: #fff;
      font-size: 10px;
    }
    .nf-container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #000;
      padding: 5px;
    }
    .header {
      display: flex;
      border-bottom: 1px solid #000;
      margin-bottom: 5px;
    }
    .logo-container {
      width: 20%;
      padding: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1px solid #000;
    }
    .store-info {
      width: 50%;
      padding: 5px;
      border-right: 1px solid #000;
    }
    .nf-title {
      width: 30%;
      padding: 5px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .nf-title h1 { font-size: 14px; font-weight: 800; margin-bottom: 2px; }
    .nf-title p { font-size: 9px; font-weight: 600; }
    
    .section {
      border: 1px solid #000;
      margin-bottom: 5px;
    }
    .section-header {
      background: #f0f0f0;
      padding: 2px 5px;
      font-weight: 800;
      font-size: 9px;
      border-bottom: 1px solid #000;
      text-transform: uppercase;
    }
    .section-content {
      padding: 5px;
      display: flex;
      flex-wrap: wrap;
    }
    .field {
      margin-right: 15px;
      margin-bottom: 2px;
    }
    .field-label {
      font-size: 8px;
      font-weight: 600;
      text-transform: uppercase;
      display: block;
    }
    .field-value {
      font-size: 10px;
      font-weight: 400;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 5px;
    }
    th {
      background: #f0f0f0;
      text-align: left;
      padding: 3px 5px;
      font-size: 9px;
      border: 1px solid #000;
      text-transform: uppercase;
    }
    td {
      padding: 3px 5px;
      border: 1px solid #000;
      font-size: 9px;
    }
    
    .totals {
      display: flex;
      justify-content: flex-end;
    }
    .totals-box {
      width: 250px;
      border: 1px solid #000;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 5px;
      border-bottom: 1px solid #eee;
    }
    .total-row:last-child {
      border-bottom: none;
      background: #f0f0f0;
      font-weight: 800;
      font-size: 11px;
    }
    
    .footer {
      margin-top: 10px;
      font-size: 8px;
      text-align: center;
      color: #666;
    }

    @media print {
      body { padding: 0; }
      .nf-container { border: 1px solid #000; width: 100%; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="nf-container">
    <div class="header">
      <div class="logo-container">
        ${data.storeLogoUrl ? `<img src="${data.storeLogoUrl}" alt="${data.storeName}" style="max-height:50px;max-width:100%;object-fit:contain;" />` : `<div style="font-weight:800;font-size:12px;">${data.storeName}</div>`}
      </div>
      <div class="store-info">
        <div style="font-weight:800; font-size:11px;">${data.storeName}</div>
        <div style="margin-top:2px;">${data.storeAddress || "Endereço não informado"}</div>
        <div>Tel: ${data.storePhone || "Não informado"}</div>
      </div>
      <div class="nf-title">
        <h1>DANFE</h1>
        <p>Documento Auxiliar da Nota Fiscal Eletrônica</p>
        <div style="margin-top:5px; font-weight:800;">Nº ${data.orderId.slice(0, 8).toUpperCase()}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">Destinatário / Remetente</div>
      <div class="section-content">
        <div class="field" style="width: 60%;">
          <span class="field-label">Nome / Razão Social</span>
          <span class="field-value">${data.customerName}</span>
        </div>
        <div class="field" style="width: 35%;">
          <span class="field-label">CPF / CNPJ</span>
          <span class="field-value">${data.customerCpf || "—"}</span>
        </div>
        <div class="field" style="width: 60%;">
          <span class="field-label">Endereço</span>
          <span class="field-value">${data.customerAddress || "Retirada / Não informado"}</span>
        </div>
        <div class="field" style="width: 20%;">
          <span class="field-label">Data de Emissão</span>
          <span class="field-value">${data.date.split(" ")[0]}</span>
        </div>
        <div class="field" style="width: 15%;">
          <span class="field-label">Hora</span>
          <span class="field-value">${data.date.split(" ")[1] || ""}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">Dados do Pagamento</div>
      <div class="section-content">
        <div class="field">
          <span class="field-label">Meio de Pagamento</span>
          <span class="field-value">${data.paymentMethod}</span>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 10%;">CÓDIGO</th>
          <th style="width: 45%;">DESCRIÇÃO DOS PRODUTOS/SERVIÇOS</th>
          <th style="width: 10%;">QTD.</th>
          <th style="width: 15%;">VLR. UNIT.</th>
          <th style="width: 20%;">VLR. TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item, index) => `
          <tr>
            <td>${(index + 1).toString().padStart(3, "0")}</td>
            <td>${item.name}</td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">${formatPrice(item.price)}</td>
            <td style="text-align: right;">${formatPrice(item.price * item.quantity)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div style="display: flex; gap: 5px;">
      <div class="section" style="flex: 1;">
        <div class="section-header">Dados Adicionais</div>
        <div class="section-content" style="font-size: 8px;">
          <strong>Informações Complementares:</strong><br>
          ${data.notes ? `Observações do Cliente: ${data.notes}<br>` : ""}
          Pedido realizado via Loja Online. 
          Este documento é uma representação simplificada de um pedido.
        </div>
      </div>
      
      <div class="totals-box">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatPrice(data.subtotal)}</span>
        </div>
        ${data.shipping > 0 ? `
        <div class="total-row">
          <span>Frete:</span>
          <span>${formatPrice(data.shipping)}</span>
        </div>
        ` : ""}
        ${data.discount > 0 ? `
        <div class="total-row" style="color: green;">
          <span>Desconto:</span>
          <span>-${formatPrice(data.discount)}</span>
        </div>
        ` : ""}
        <div class="total-row">
          <span>VALOR TOTAL:</span>
          <span>${formatPrice(data.total)}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      Gerado eletronicamente por ${data.storeName} - Documento Auxiliar
    </div>
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  }
}