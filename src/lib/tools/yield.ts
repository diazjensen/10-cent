// Rental yield and ROI (PRD T7). Pure functions.

export type YieldInput = {
  price: number;               // purchase price
  monthlyRent: number;
  monthlyMaintenance: number;  // borne by the owner
  vacancyMonths: number;       // per year
  propertyTax: number;         // per year
  taxSlab: number;             // income-tax slab %, applied after 30% standard deduction (Sec 24a)
  appreciation: number;        // % per year
  rentGrowth: number;          // % per year
  acquisitionCost: number;     // % of price: stamp duty, registration, brokerage
};

export type YieldYear = { year: number; rent: number; netIncome: number; value: number };

export function rentalYield(i: YieldInput) {
  const occupied = Math.max(0, 12 - Math.min(12, i.vacancyMonths));
  const annualRent = i.monthlyRent * 12;
  const grossYield = i.price > 0 ? (annualRent / i.price) * 100 : 0;
  const yearNet = (rent: number) => {
    const collected = rent * occupied;
    const nav = Math.max(0, collected - i.propertyTax);
    const tax = (nav * 0.7 * i.taxSlab) / 100;
    return collected - i.monthlyMaintenance * 12 - i.propertyTax - tax;
  };
  const net1 = yearNet(i.monthlyRent);
  const netYield = i.price > 0 ? (net1 / i.price) * 100 : 0;
  const invested = i.price * (1 + i.acquisitionCost / 100);
  const years: YieldYear[] = [];
  let cumulative = 0;
  for (let y = 1; y <= 5; y++) {
    const rent = i.monthlyRent * Math.pow(1 + i.rentGrowth / 100, y - 1);
    const n = yearNet(rent);
    cumulative += n;
    years.push({ year: y, rent: rent * 12, netIncome: n, value: i.price * Math.pow(1 + i.appreciation / 100, y) });
  }
  const finalValue = years[4].value;
  const gain = finalValue - invested + cumulative;
  const roi5 = invested > 0 ? (gain / invested) * 100 : 0;
  const cagr = invested > 0 && finalValue + cumulative > 0 ? (Math.pow((finalValue + cumulative) / invested, 1 / 5) - 1) * 100 : 0;
  return { grossYield, netYield, netIncomeYear1: net1, invested, years, totalNetIncome: cumulative, finalValue, gain, roi5, cagr };
}
