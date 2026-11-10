// Property valuation estimate (PRD T5). Transparent, rule-based adjustments on the locality's average rate.

export type ValuationInput = {
  basePsf: number;        // locality average price per sq ft (super built-up basis)
  area: number;           // sq ft
  bhk: number;
  ageYears: number;
  floor: number;          // 0 = ground
  totalFloors: number;
  furnishing: "unfurnished" | "semi" | "furnished";
};

export type Adjustment = { label: string; pct: number; reason: string };

export function valuationAdjustments(i: ValuationInput): Adjustment[] {
  const a: Adjustment[] = [];
  if (i.bhk <= 1) a.push({ label: "Unit size", pct: 4, reason: "1 BHK units sell at a higher rate per sq ft" });
  else if (i.bhk === 3) a.push({ label: "Unit size", pct: -2, reason: "3 BHK units trade slightly below the average rate" });
  else if (i.bhk >= 4) a.push({ label: "Unit size", pct: -4, reason: "Large units trade below the average rate" });
  else a.push({ label: "Unit size", pct: 0, reason: "2 BHK is the locality benchmark" });

  if (i.ageYears <= 1) a.push({ label: "Age", pct: 5, reason: "New or under 1 year old" });
  else if (i.ageYears <= 5) a.push({ label: "Age", pct: 0, reason: "1–5 years old" });
  else if (i.ageYears <= 10) a.push({ label: "Age", pct: -6, reason: "5–10 years old" });
  else if (i.ageYears <= 20) a.push({ label: "Age", pct: -12, reason: "10–20 years old" });
  else a.push({ label: "Age", pct: -20, reason: "Over 20 years old" });

  if (i.floor <= 0) a.push({ label: "Floor", pct: -3, reason: "Ground floor" });
  else if (i.totalFloors > 0 && i.floor >= i.totalFloors && i.totalFloors > 4) a.push({ label: "Floor", pct: 1, reason: "Top floor (views, but heat and seepage risk)" });
  else if (i.floor >= 11) a.push({ label: "Floor", pct: 4, reason: "High floor (11+)" });
  else if (i.floor >= 4) a.push({ label: "Floor", pct: 2, reason: "Mid floor (4–10)" });
  else a.push({ label: "Floor", pct: 0, reason: "Low floor (1–3)" });

  if (i.furnishing === "furnished") a.push({ label: "Furnishing", pct: 5, reason: "Fully furnished" });
  else if (i.furnishing === "semi") a.push({ label: "Furnishing", pct: 2, reason: "Semi-furnished" });
  else a.push({ label: "Furnishing", pct: 0, reason: "Unfurnished" });
  return a;
}

export function estimateValue(i: ValuationInput, spreadPct = 7) {
  const adjustments = valuationAdjustments(i);
  const factor = adjustments.reduce((f, a) => f * (1 + a.pct / 100), 1);
  const psf = i.basePsf * factor;
  const mid = psf * i.area;
  return { adjustments, factor, psf, mid, low: mid * (1 - spreadPct / 100), high: mid * (1 + spreadPct / 100) };
}

export function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
