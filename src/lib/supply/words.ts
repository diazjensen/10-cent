// Amount in words using the Indian system (lakh, crore), as required on GST invoices.
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function two(n: number) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}
function three(n: number) {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" ");
}

export function inWords(n: number): string {
  n = Math.floor(n);
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  return [crore ? `${inWords(crore)} Crore` : "", lakh ? `${two(lakh)} Lakh` : "", thousand ? `${two(thousand)} Thousand` : "", n ? three(n) : ""].filter(Boolean).join(" ");
}

export function rupeesInWords(paise: number) {
  const r = Math.floor(paise / 100), p = paise % 100;
  return `Rupees ${inWords(r)}${p ? ` and ${two(p)} Paise` : ""} Only`;
}
