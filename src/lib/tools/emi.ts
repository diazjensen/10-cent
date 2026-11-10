// Home-loan maths (PRD T1, T2). Pure functions, safe on client and server.

/** Monthly EMI for a reducing-balance loan. rate is annual % (e.g. 8.5), months is tenure. */
export function emi(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

/** Principal that a given EMI can service. Inverse of emi(). */
export function principalForEmi(monthlyEmi: number, annualRate: number, months: number): number {
  if (monthlyEmi <= 0 || months <= 0) return 0;
  const r = annualRate / 12 / 100;
  if (r === 0) return monthlyEmi * months;
  const f = Math.pow(1 + r, months);
  return (monthlyEmi * (f - 1)) / (r * f);
}

export type AmortRow = {
  month: number;          // 1-based
  emi: number;
  principal: number;
  interest: number;
  prepayment: number;
  balance: number;        // closing balance
};

export type YearRow = { year: number; principal: number; interest: number; prepayment: number; balance: number; paid: number };

export type Prepayment = {
  oneTimeAmount?: number;   // lump sum
  oneTimeMonth?: number;    // paid at the end of this month (1-based)
  yearlyAmount?: number;    // recurring, paid at the end of every 12th month
  yearlyFromYear?: number;  // first year the recurring prepayment is made (default 1)
  mode?: "tenure" | "emi";  // reduce tenure (keep EMI) or reduce EMI (keep tenure)
};

export type Schedule = {
  rows: AmortRow[];
  years: YearRow[];
  totalInterest: number;
  totalPrincipal: number;
  totalPrepaid: number;
  months: number;           // actual months until loan closes
  firstEmi: number;
  lastEmi: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Month-by-month amortisation, optionally with part-prepayments. */
export function amortise(principal: number, annualRate: number, months: number, pre: Prepayment = {}): Schedule {
  const r = annualRate / 12 / 100;
  let balance = principal;
  let curEmi = emi(principal, annualRate, months);
  const firstEmi = curEmi;
  const rows: AmortRow[] = [];
  const mode = pre.mode ?? "tenure";
  const fromYear = Math.max(1, pre.yearlyFromYear ?? 1);
  for (let m = 1; m <= months && balance > 0.005; m++) {
    const interest = balance * r;
    let princ = Math.min(curEmi - interest, balance);
    if (m === months) princ = balance; // absorb rounding on the last instalment
    balance -= princ;
    let prepay = 0;
    if (pre.oneTimeAmount && pre.oneTimeMonth === m) prepay += pre.oneTimeAmount;
    if (pre.yearlyAmount && m % 12 === 0 && m / 12 >= fromYear) prepay += pre.yearlyAmount;
    prepay = Math.min(prepay, balance);
    balance -= prepay;
    rows.push({ month: m, emi: interest + princ, principal: princ, interest, prepayment: prepay, balance: Math.max(0, balance) });
    if (prepay > 0 && mode === "emi" && balance > 0) curEmi = emi(balance, annualRate, months - m);
  }
  const years: YearRow[] = [];
  for (const row of rows) {
    const y = Math.ceil(row.month / 12);
    let yr = years[y - 1];
    if (!yr) yr = years[y - 1] = { year: y, principal: 0, interest: 0, prepayment: 0, balance: 0, paid: 0 };
    yr.principal += row.principal;
    yr.interest += row.interest;
    yr.prepayment += row.prepayment;
    yr.paid += row.emi + row.prepayment;
    yr.balance = row.balance;
  }
  const totalInterest = rows.reduce((s, x) => s + x.interest, 0);
  const totalPrepaid = rows.reduce((s, x) => s + x.prepayment, 0);
  return {
    rows,
    years: years.map((y) => ({ ...y, principal: round2(y.principal), interest: round2(y.interest), prepayment: round2(y.prepayment), paid: round2(y.paid), balance: round2(y.balance) })),
    totalInterest,
    totalPrincipal: principal,
    totalPrepaid,
    months: rows.length,
    firstEmi,
    lastEmi: rows.length ? rows[rows.length - 1].emi : 0,
  };
}

/** RBI loan-to-value caps for housing loans. */
export function ltvFor(price: number): number {
  if (price <= 30_00_000) return 0.9;
  if (price <= 75_00_000) return 0.8;
  return 0.75;
}

export type EligibilityInput = {
  monthlyIncome: number;   // net take-home
  existingEmis: number;    // monthly
  annualRate: number;
  years: number;
  foir: number;            // % of income that may go to all EMIs, e.g. 50
  downPayment: number;     // savings available for down payment
};

export type EligibilityResult = {
  maxEmi: number;
  maxLoan: number;
  affordablePrice: number;
  loanAtPrice: number;
  downPaymentNeeded: number;
  ltv: number;
};

/**
 * Max loan from FOIR, then the highest property price that the loan + savings can fund
 * while respecting RBI LTV slabs (90% up to ₹30 L, 80% up to ₹75 L, 75% above).
 */
export function eligibility(i: EligibilityInput): EligibilityResult {
  const maxEmi = Math.max(0, (i.monthlyIncome * i.foir) / 100 - i.existingEmis);
  const maxLoan = principalForEmi(maxEmi, i.annualRate, i.years * 12);
  const dp = Math.max(0, i.downPayment);
  const slabs: Array<[number, number, number]> = [
    [0, 30_00_000, 0.9],
    [30_00_000, 75_00_000, 0.8],
    [75_00_000, Infinity, 0.75],
  ];
  let best = 0;
  for (const [lo, hi, k] of slabs) {
    // Feasible P satisfies P <= min(maxLoan, k*P) + dp; the slack is decreasing in P, so the root is the max.
    const root = Math.min(maxLoan + dp, dp / (1 - k));
    if (root > lo) best = Math.max(best, Math.min(hi, root));
  }
  const ltv = ltvFor(best);
  const loanAtPrice = Math.min(maxLoan, best * ltv);
  return { maxEmi, maxLoan, affordablePrice: best, loanAtPrice, downPaymentNeeded: Math.max(0, best - loanAtPrice), ltv };
}
