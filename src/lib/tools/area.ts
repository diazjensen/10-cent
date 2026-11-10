// Area conversion (PRD T3). Everything converts through square feet.

export type AreaUnit = "sqft" | "sqm" | "sqyd" | "gaj" | "acre" | "hectare" | "cent" | "bigha";

export const AREA_UNITS: Array<{ key: AreaUnit; label: string; short: string }> = [
  { key: "sqft", label: "Square feet", short: "sq ft" },
  { key: "sqm", label: "Square metre", short: "sq m" },
  { key: "sqyd", label: "Square yard", short: "sq yd" },
  { key: "gaj", label: "Gaj", short: "gaj" },
  { key: "acre", label: "Acre", short: "acre" },
  { key: "hectare", label: "Hectare", short: "ha" },
  { key: "cent", label: "Cent", short: "cent" },
  { key: "bigha", label: "Bigha", short: "bigha" },
];

/**
 * Bigha is not a standard unit; its size varies by state (and sometimes district).
 * These are the commonly used revenue-department values in square feet.
 * Assumptions: Rajasthan uses the pucca bigha, Punjab/Haryana the kachha bigha of 4 kanal/~9,070 sq ft.
 */
export const BIGHA_SQFT: Record<string, { sqft: number; note?: string }> = {
  "Assam": { sqft: 14400 },
  "Bihar": { sqft: 27220 },
  "Gujarat": { sqft: 17427 },
  "Haryana": { sqft: 9070, note: "Kachha bigha" },
  "Himachal Pradesh": { sqft: 8712 },
  "Jharkhand": { sqft: 27220 },
  "Madhya Pradesh": { sqft: 12000 },
  "Punjab": { sqft: 9070, note: "Kachha bigha" },
  "Rajasthan": { sqft: 27225, note: "Pucca bigha; kachha bigha is 17,424 sq ft" },
  "Uttar Pradesh": { sqft: 27000 },
  "Uttarakhand": { sqft: 6804 },
  "West Bengal": { sqft: 14400 },
};

export const DEFAULT_BIGHA_STATE = "Uttar Pradesh";

export function sqftPer(unit: AreaUnit, bighaState = DEFAULT_BIGHA_STATE): number {
  switch (unit) {
    case "sqft": return 1;
    case "sqm": return 10.7639104;
    case "sqyd": return 9;
    case "gaj": return 9; // 1 gaj = 1 square yard in property usage
    case "acre": return 43560;
    case "hectare": return 107639.104;
    case "cent": return 435.6; // 1/100 acre
    case "bigha": return (BIGHA_SQFT[bighaState] ?? BIGHA_SQFT[DEFAULT_BIGHA_STATE]).sqft;
  }
}

export function convertArea(value: number, from: AreaUnit, to: AreaUnit, bighaState?: string): number {
  return (value * sqftPer(from, bighaState)) / sqftPer(to, bighaState);
}

/** Readable number for converted areas: more decimals for big units. */
export function fmtArea(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return String(Number(n.toFixed(digits)));
}
