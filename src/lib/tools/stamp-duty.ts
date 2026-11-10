// Stamp duty and registration charges by state (PRD T6).
// Rates are the commonly applied residential rates for urban areas as of 2026. They change through state
// notifications and budget announcements, and guidance (circle) value may be used instead of the agreement
// value when it is higher. Always verify on the state IGR / registration department website.

export type Buyer = "male" | "female" | "joint";

export type StampDutyRule = {
  code: string;
  state: string;
  igr: string;                         // state registration department website
  areas?: Array<{ key: string; label: string }>;
  summary: string[];                   // human-readable rules for the table
  compute: (value: number, buyer: Buyer, area?: string) => { stampDuty: number; cess: number; registration: number; notes: string[] };
};

const pct = (v: number, p: number) => (v * p) / 100;

export const STAMP_DUTY_RULES: StampDutyRule[] = [
  {
    code: "KA",
    state: "Karnataka",
    igr: "https://igr.karnataka.gov.in",
    summary: [
      "Stamp duty 2% up to ₹20 L, 3% for ₹21–45 L, 5% above ₹45 L",
      "Surcharge and cess add about 12% of the stamp duty (10% cess + 2% BBMP surcharge in Bengaluru)",
      "Registration 1%",
      "No separate concession for women",
    ],
    compute: (v) => {
      const sdRate = v <= 20_00_000 ? 2 : v <= 45_00_000 ? 3 : 5;
      const sd = pct(v, sdRate);
      return { stampDuty: sd, cess: pct(sd, 12), registration: pct(v, 1), notes: [`Stamp duty slab: ${sdRate}%`] };
    },
  },
  {
    code: "MH",
    state: "Maharashtra",
    igr: "https://igrmaharashtra.gov.in",
    areas: [
      { key: "mumbai", label: "Mumbai (within BMC limits)" },
      { key: "urban", label: "Pune, Thane, Nagpur and other municipal corporations" },
      { key: "council", label: "Municipal council / cantonment" },
      { key: "rural", label: "Gram panchayat (rural)" },
    ],
    summary: [
      "Mumbai: 5% stamp duty + 1% metro cess = 6%",
      "Other municipal corporations: 5% stamp duty + 1% metro cess / LBT = 6%",
      "Municipal council: 5% + 1% = 6%; gram panchayat: 5% + 0% = 5%",
      "Women buyers: 1% concession on stamp duty (sole female buyer)",
      "Registration 1%, capped at ₹30,000",
    ],
    compute: (v, buyer, area = "mumbai") => {
      const sdRate = 5 - (buyer === "female" ? 1 : 0);
      const cessRate = area === "rural" ? 0 : 1;
      return {
        stampDuty: pct(v, sdRate),
        cess: pct(v, cessRate),
        registration: Math.min(pct(v, 1), 30_000),
        notes: [area === "mumbai" ? "1% metro cess applies within Mumbai" : cessRate ? "1% metro cess / LBT applies" : "No cess in gram panchayat areas", ...(buyer === "female" ? ["1% women's concession applied"] : [])],
      };
    },
  },
  {
    code: "TS",
    state: "Telangana",
    igr: "https://registration.telangana.gov.in",
    summary: ["Stamp duty 4% + transfer duty 1.5% = 5.5%", "Registration 2%", "No separate concession for women"],
    compute: (v) => ({ stampDuty: pct(v, 4), cess: pct(v, 1.5), registration: pct(v, 2), notes: ["Transfer duty 1.5% shown as cess"] }),
  },
  {
    code: "TN",
    state: "Tamil Nadu",
    igr: "https://tnreginet.gov.in",
    summary: ["Stamp duty 7%", "Registration 2%", "No separate concession for women"],
    compute: (v) => ({ stampDuty: pct(v, 7), cess: 0, registration: pct(v, 2), notes: [] }),
  },
  {
    code: "HR",
    state: "Haryana",
    igr: "https://jamabandi.nic.in",
    summary: ["Urban areas: men 7%, women 5%, joint (man + woman) 6% (includes 2% municipal duty)", "Registration fee on a slab, up to ₹50,000"],
    compute: (v, buyer) => {
      const rate = buyer === "female" ? 5 : buyer === "joint" ? 6 : 7;
      const reg = v <= 5_00_000 ? 15_000 : v <= 25_00_000 ? 25_000 : v <= 50_00_000 ? 40_000 : 50_000;
      return { stampDuty: pct(v, rate - 2), cess: pct(v, 2), registration: reg, notes: ["2% municipal duty shown as cess", `Stamp duty for ${buyer} buyer: ${rate}%`] };
    },
  },
  {
    code: "DL",
    state: "Delhi",
    igr: "https://revenue.delhi.gov.in",
    summary: ["Men 6%, women 4%, joint 5%", "Registration 1% + ₹100 pasting fee"],
    compute: (v, buyer) => {
      const rate = buyer === "female" ? 4 : buyer === "joint" ? 5 : 6;
      return { stampDuty: pct(v, rate), cess: 0, registration: pct(v, 1) + 100, notes: [`Stamp duty for ${buyer} buyer: ${rate}%`] };
    },
  },
  {
    code: "UP",
    state: "Uttar Pradesh",
    igr: "https://igrsup.gov.in",
    summary: ["Stamp duty 7%", "Women buyers: 1% rebate on value up to ₹1 Cr", "Registration 1%"],
    compute: (v, buyer) => {
      const rebate = buyer === "female" ? pct(Math.min(v, 1_00_00_000), 1) : 0;
      return { stampDuty: pct(v, 7) - rebate, cess: 0, registration: pct(v, 1), notes: rebate ? ["1% women's rebate applied on value up to ₹1 Cr"] : [] };
    },
  },
  {
    code: "GJ",
    state: "Gujarat",
    igr: "https://garvi.gujarat.gov.in",
    summary: ["Stamp duty 3.5% + 1.4% surcharge = 4.9%", "Registration 1%; waived for women buyers"],
    compute: (v, buyer) => ({
      stampDuty: pct(v, 3.5),
      cess: pct(v, 1.4),
      registration: buyer === "female" ? 0 : pct(v, 1),
      notes: ["1.4% surcharge shown as cess", ...(buyer === "female" ? ["Registration fee waived for women"] : [])],
    }),
  },
  {
    code: "KL",
    state: "Kerala",
    igr: "https://keralaregistration.gov.in",
    summary: ["Stamp duty 8%", "Registration 2%"],
    compute: (v) => ({ stampDuty: pct(v, 8), cess: 0, registration: pct(v, 2), notes: [] }),
  },
  {
    code: "WB",
    state: "West Bengal",
    igr: "https://wbregistration.gov.in",
    summary: ["Kolkata and urban areas: 6% up to ₹1 Cr, 7% above ₹1 Cr", "Registration 1%"],
    compute: (v) => {
      const rate = v <= 1_00_00_000 ? 6 : 7;
      return { stampDuty: pct(v, rate), cess: 0, registration: pct(v, 1), notes: [`Stamp duty slab: ${rate}%`] };
    },
  },
];

export function stampDuty(code: string, value: number, buyer: Buyer, area?: string) {
  const rule = STAMP_DUTY_RULES.find((r) => r.code === code) ?? STAMP_DUTY_RULES[0];
  const c = rule.compute(Math.max(0, value), buyer, area);
  const total = c.stampDuty + c.cess + c.registration;
  return { rule, ...c, total, effectiveRate: value > 0 ? (total / value) * 100 : 0 };
}
