
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
  customerAddress?: string;
  customerCpf?: string;
  items: OrderLabelItem[];
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
  storeName: string;
}

export function generateOrderLabel(data: OrderLabelData): void {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Etiqueta de Pedido #${data.orderId.slice(0, 8)}</title>
  <style>
    @page { margin: 0; }
    body { 
      font-family: 'Courier New', Courier, monospace; 
      padding: 10px; 
      margin: 0; 
      width: 80mm;
      font-size: 12px;
      line-height: 1.2;
    }
    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
    .store-name { font-weight: bold; font-size: 16px; text-transform: uppercase; }
    .order-id { font-weight: bold; font-size: 14px; margin: 5px 0; }
    
    .section { border-bottom: 1px dashed #000; padding: 5px 0; }
    .section-title { font-weight: bold; text-decoration: underline; margin-bottom: 3px; }
    
    .info-row { display: flex; flex-direction: column; margin-bottom: 3px; }
    .label { font-weight: bold; }
    
    .items-table { width: 100%; border-collapse: collapse; margin: 5px 0; }
    .items-table th { text-align: left; border-bottom: 1px solid #000; }
    .items-table td { vertical-align: top; padding: 2px 0; }
    
    .total-row { font-weight: bold; font-size: 14px; text-align: right; margin-top: 5px; }
    
    .footer { text-align: center; margin-top: 10px; font-size: 10px; }
    
    @media print {
      body { width: 80mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="store-name">${data.storeName}</div>
    <div class="order-id">PEDIDO: #${data.orderId.slice(0, 8).toUpperCase()}</div>
    <div>${data.date}</div>
  </div>

  <div class="section">
    <div class="section-title">DESTINATÁRIO:</div>
    <div class="info-row">
      <span class="value">${data.customerName.toUpperCase()}</span>
    </div>
    ${data.customerPhone ? `<div>TEL: ${data.customerPhone}</div>` : ""}
    ${data.customerCpf ? `<div>CPF: ${data.customerCpf}</div>` : ""}
    <div style="margin-top: 3px; font-weight: bold;">
      ${data.customerAddress || "ENDEREÇO NÃO INFORMADO"}
    </div>
  </div>

  <div class="section">
    <div class="section-title">PRODUTOS:</div>
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 15%">QTD</th>
          <th>DESCRIÇÃO</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map(item => `
          <tr>
            <td>${item.quantity}x</td>
            <td>
              ${item.name.toUpperCase()}
              ${item.variation ? `<br><small>VAR: ${item.variation}</small>` : ""}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="info-row">
      <span class="label">PAGAMENTO:</span>
      <span class="value">${data.paymentMethod.toUpperCase()} (${data.paymentStatus.toUpperCase()})</span>
    </div>
    ${data.notes ? `
      <div class="info-row" style="margin-top: 5px;">
        <span class="label">OBSERVAÇÕES:</span>
        <span class="value">${data.notes}</span>
      </div>
    ` : ""}
  </div>

  <div class="total-row">
    TOTAL: ${formatPrice(data.total)}
  </div>

  <div class="footer">
    OBRIGADO PELA PREFERÊNCIA!<br>
    www.lovable.dev
  </div>

  <script>
    window.onload = () => {
      window.print();
      setTimeout(() => window.close(), 500);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
