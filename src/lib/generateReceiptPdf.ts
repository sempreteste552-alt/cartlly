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
  <title>Comprovante - Pedido #${data.orderId.slice(0, 8)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&family=Inter:wght@400;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', sans-serif; 
      color: #1a1a1a; 
      padding: 20px; 
      background-color: #f8fafc;
    }
    .receipt {
      max-width: 500px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }
    .bank-header {
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 15px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .bank-header h1 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 800;
    }
    .bank-header .date {
      font-size: 12px;
      color: #64748b;
    }
    
    .main-value {
      text-align: center;
      padding: 30px 0;
      background: #f1f5f9;
      margin-bottom: 25px;
    }
    .main-value .label {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    .main-value .amount {
      font-size: 32px;
      font-weight: 800;
      color: #0f172a;
    }

    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .info-row .label {
      color: #64748b;
    }
    .info-row .value {
      font-weight: 600;
      text-align: right;
    }

    .items-list {
      margin-bottom: 20px;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-bottom: 5px;
      color: #334155;
    }

    .authentication {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
      text-align: center;
    }
    .authentication p {
      font-size: 9px;
      color: #94a3b8;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .auth-code {
      font-family: 'Roboto Mono', monospace;
      font-size: 10px;
      color: #475569;
      word-break: break-all;
    }
    
    .footer-note {
      margin-top: 20px;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }

    @media print {
      body { background: white; padding: 0; }
      .receipt { box-shadow: none; border: 1px solid #000; width: 100%; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="bank-header">
      <h1>Comprovante de Transação</h1>
      <div class="date">${data.date}</div>
    </div>

    <div class="main-value">
      <div class="label">Valor Total</div>
      <div class="amount">${formatPrice(data.total)}</div>
    </div>

    <div class="section">
      <div class="section-title">Dados do Beneficiário</div>
      <div class="info-row">
        <span class="label">Nome/Razão Social:</span>
        <span class="value">${data.storeName}</span>
      </div>
      <div class="info-row">
        <span class="label">Identificação:</span>
        <span class="value">PAGAMENTO DE PEDIDO #${data.orderId.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Dados do Pagador</div>
      <div class="info-row">
        <span class="label">Nome:</span>
        <span class="value">${data.customerName}</span>
      </div>
      <div class="info-row">
        <span class="label">CPF:</span>
        <span class="value">${maskedCpf}</span>
      </div>
      <div class="info-row">
        <span class="label">Meio de Pagamento:</span>
        <span class="value">${data.paymentMethod}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Detalhamento da Compra</div>
      <div class="items-list">
        ${data.items.map(item => `
          <div class="item-row">
            <span>${item.quantity}x ${item.name}</span>
            <span>${formatPrice(item.price * item.quantity)}</span>
          </div>
        `).join("")}
      </div>
      <div class="info-row" style="margin-top: 10px; font-weight: 700; border-top: 1px solid #f1f5f9; padding-top: 5px;">
        <span class="label" style="color: #1a1a1a">Total:</span>
        <span class="value">${formatPrice(data.total)}</span>
      </div>
    </div>

    <div class="authentication">
      <p>Autenticação Eletrônica</p>
      <div class="auth-code">${authenticationCode}</div>
    </div>

    <div class="footer-note">
      Comprovante gerado eletronicamente em conformidade com as normas bancárias.<br>
      Este documento é um registro de transação financeira.
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