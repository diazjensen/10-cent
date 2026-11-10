// Partner services (PRD §5.3). Rates are indicative and for comparison only.

export const BANK_RATES = [
  { bank: "State Bank of India", min: 7.5, max: 8.45, fee: "0.35% (max ₹10,000) + GST", maxTenure: 30 },
  { bank: "Bank of Baroda", min: 7.45, max: 9.1, fee: "Up to 0.50% (max ₹15,000) + GST", maxTenure: 30 },
  { bank: "Punjab National Bank", min: 7.45, max: 9.2, fee: "0.35% (max ₹15,000) + GST", maxTenure: 30 },
  { bank: "HDFC Bank", min: 7.9, max: 9.05, fee: "Up to 0.50% or ₹3,000, whichever is higher", maxTenure: 30 },
  { bank: "ICICI Bank", min: 7.7, max: 8.8, fee: "0.50%–2.00% + GST", maxTenure: 30 },
  { bank: "Axis Bank", min: 8.35, max: 9.15, fee: "Up to 1% (min ₹10,000) + GST", maxTenure: 30 },
  { bank: "Kotak Mahindra Bank", min: 7.99, max: 9.0, fee: "Up to 0.50% + GST", maxTenure: 20 },
  { bank: "LIC Housing Finance", min: 7.5, max: 9.25, fee: "Up to 0.25% (max ₹15,000) + GST", maxTenure: 30 },
] as const;

export const RATES_AS_OF = "November 2026";

export const SERVICES = [
  { slug: "home-loan", tag: "[Home loan]", title: "Home loans", live: true, blurb: "Compare indicative rates from 8 lenders and get a call from a loan advisor. No fee to you." },
  { slug: "packers-movers", tag: "[Packers & movers]", title: "Packers & movers", live: false, blurb: "Insured, GST-registered movers with fixed quotes for local and inter-city shifts." },
  { slug: "interiors", tag: "[Home interiors]", title: "Home interiors", live: false, blurb: "Modular kitchens, wardrobes and full-home interiors with itemised quotes." },
  { slug: "rental-agreement", tag: "[Rental agreement]", title: "Rental agreement & legal", live: false, blurb: "e-Stamped rental agreements and title checks by empanelled advocates." },
  { slug: "nri-management", tag: "[NRI property management]", title: "NRI property management", live: false, blurb: "Tenant finding, rent collection, repairs and inspections for owners abroad." },
] as const;

export type ServiceSlug = (typeof SERVICES)[number]["slug"];
