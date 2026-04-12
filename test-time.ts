const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: false,
});
const now = new Date();
const parts = formatter.formatToParts(now);
const d: any = {};
parts.forEach(({ type, value }) => { d[type] = value; });
console.log("UTC:", now.toISOString());
console.log("Parts:", JSON.stringify(d));
console.log("Hour:", d.hour);
console.log("Minute:", d.minute);
