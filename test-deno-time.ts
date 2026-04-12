const now = new Date();
const brTime = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
const brDate = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
console.log("System Date:", now.toISOString());
console.log("BR Time:", brTime);
console.log("BR Date:", brDate);
