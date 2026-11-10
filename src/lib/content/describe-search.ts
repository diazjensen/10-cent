import { formatPrice, formatINR } from "@/lib/format";
import { PROPERTY_TYPE_LABEL, FURNISHING_LABEL } from "@/lib/constants";

/** Human-readable chips for a /search query string, e.g. "Rent · 2, 3 BHK · Under ₹60,000". */
export function describeSearch(query: string, cityNames: Record<string, string> = {}, localityNames: Record<number, string> = {}): string[] {
  const q = new URLSearchParams(query);
  const out: string[] = [];
  const tx = q.get("tx");
  if (tx) out.push(tx === "sell" ? "Buy" : tx === "rent" ? "Rent" : tx === "pg" ? "PG" : tx);
  if (q.get("cat") === "commercial") out.push("Commercial");
  const city = q.get("city");
  if (city) out.push(cityNames[city] ?? city);
  const loc = q.get("loc");
  if (loc) {
    const names = loc.split(",").map((id) => localityNames[Number(id)]).filter(Boolean);
    if (names.length) out.push(names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", "));
  }
  if (q.get("q")) out.push(`“${q.get("q")}”`);
  const type = q.get("type");
  if (type) out.push(type.split(",").map((t) => PROPERTY_TYPE_LABEL[t] ?? t).join(", "));
  const bhk = q.get("bhk");
  if (bhk) out.push(`${bhk.split(",").map((b) => (b === "5" ? "5+" : b)).join(", ")} BHK`);
  const money = (n: number) => (tx === "sell" || (!tx && n >= 1e5) ? formatPrice(n, { short: true }) : `₹${formatINR(n)}`);
  const min = Number(q.get("min")) || 0, max = Number(q.get("max")) || 0;
  if (min && max) out.push(`${money(min)} – ${money(max)}`);
  else if (max) out.push(`Under ${money(max)}`);
  else if (min) out.push(`Above ${money(min)}`);
  const furn = q.get("furn");
  if (furn) out.push(furn.split(",").map((f) => FURNISHING_LABEL[f] ?? f).join(", "));
  if (q.get("cs") === "ready") out.push("Ready to move");
  if (q.get("cs") === "under_construction") out.push("Under construction");
  if (q.get("by")) out.push(`By ${q.get("by")!.split(",").join(", ")}`);
  if (q.get("verified") === "1") out.push("Verified only");
  if (q.get("rera") === "1") out.push("RERA");
  if (q.get("newlaunch") === "1") out.push("New launch");
  if (q.get("bounds") || q.get("near")) out.push("Map area");
  return out;
}
