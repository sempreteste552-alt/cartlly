
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrderExportData {
  id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  total: number;
  status: string;
  created_at: string;
  payment_method?: string;
  items_summary: string;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

export function exportToCSV(data: OrderExportData[], filename = "pedidos.csv") {
  const headers = ["ID", "Cliente", "Email", "Telefone", "Endereço", "Total", "Status", "Data", "Pagamento", "Itens"];
  const rows = data.map(o => [
    o.id.slice(0, 8),
    o.customer_name,
    o.customer_email || "",
    o.customer_phone || "",
    o.customer_address || "",
    o.total.toFixed(2),
    o.status,
    format(new Date(o.created_at), "dd/MM/yyyy HH:mm"),
    o.payment_method || "",
    o.items_summary
  ]);

  const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToXLSX(data: OrderExportData[], filename = "pedidos.xlsx") {
  const rows = data.map(o => ({
    ID: o.id.slice(0, 8),
    Cliente: o.customer_name,
    Email: o.customer_email || "",
    Telefone: o.customer_phone || "",
    Endereço: o.customer_address || "",
    Total: o.total,
    Status: o.status,
    Data: format(new Date(o.created_at), "dd/MM/yyyy HH:mm"),
    Pagamento: o.payment_method || "",
    Itens: o.items_summary
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos");
  XLSX.writeFile(workbook, filename);
}

export function exportToPDF(data: OrderExportData[], filename = "pedidos.pdf") {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text("Histórico de Pedidos", 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 30);

  const tableData = data.map(o => [
    o.id.slice(0, 8),
    o.customer_name,
    formatPrice(o.total),
    o.status,
    format(new Date(o.created_at), "dd/MM/yyyy")
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["ID", "Cliente", "Total", "Status", "Data"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [66, 66, 66] }
  });

  doc.save(filename);
}
