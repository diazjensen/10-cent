// Deterministic flat architectural illustrations used as seed imagery.
// Real uploads replace these; they exist so demo data looks intentional rather than broken.

type Rng = () => number;
function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: Rng, a: readonly T[]) => a[Math.floor(r() * a.length)];
const between = (r: Rng, a: number, b: number) => a + r() * (b - a);

const SKIES = [
  ["#EDE6D6", "#F6F1E7"],
  ["#D9E3E1", "#EEF2EF"],
  ["#F1D9C6", "#F8EBDF"],
  ["#D8DEE8", "#EEF0F4"],
  ["#E7E0CF", "#F3EFE4"],
];
const WALLS = ["#C8664A", "#D9C3A5", "#5B6770", "#EFE8DA", "#8FA392", "#B9A48A", "#E4D5BE", "#7D8A84", "#D5B79A"];
const ACCENT = ["#23262B", "#2F3A3F", "#3B3330"];
const GLASS = ["#A9BCC4", "#9FB3B9", "#B7C6CB", "#8EA6AE"];
const TREE = ["#5F7A5E", "#6E8B6A", "#4F6B55", "#7C9474"];

function wrap(inner: string, sky: string[]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs><rect width="800" height="600" fill="url(#s)"/>${inner}</svg>`;
}

function trees(r: Rng, n: number, y: number) {
  let s = "";
  for (let i = 0; i < n; i++) {
    const x = between(r, 20, 780), h = between(r, 50, 110), w = h * between(r, 0.45, 0.7), c = pick(r, TREE);
    s += `<rect x="${x - 2}" y="${y - h * 0.35}" width="4" height="${h * 0.35}" fill="#4A3F36"/>`;
    s += r() > 0.5
      ? `<ellipse cx="${x}" cy="${y - h * 0.55}" rx="${w / 2}" ry="${h / 2}" fill="${c}"/>`
      : `<path d="M${x} ${y - h} L${x + w / 2} ${y - h * 0.25} L${x - w / 2} ${y - h * 0.25}Z" fill="${c}"/>`;
  }
  return s;
}

function sun(r: Rng) {
  return `<circle cx="${between(r, 80, 720)}" cy="${between(r, 70, 150)}" r="${between(r, 26, 44)}" fill="#F3C98B" opacity=".85"/>`;
}

function tower(r: Rng) {
  let s = sun(r);
  const ground = 520;
  const blocks = 1 + Math.floor(r() * 3);
  for (let b = 0; b < blocks; b++) {
    const w = between(r, 150, 230), x = 400 - (blocks * 210) / 2 + b * 210 + between(r, -10, 10), h = between(r, 260, 430);
    const top = ground - h, wall = pick(r, WALLS), trim = pick(r, ["#F4EFE6", "#2B2F33", "#E9E2D3"]);
    s += `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${wall}"/>`;
    s += `<rect x="${x - 6}" y="${top - 10}" width="${w + 12}" height="12" fill="${trim}"/>`;
    const cols = Math.floor(w / 38), rows = Math.floor((h - 40) / 34), glass = pick(r, GLASS);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const wx = x + 14 + j * ((w - 20) / cols), wy = top + 20 + i * 34;
      s += `<rect x="${wx}" y="${wy}" width="${(w - 20) / cols - 12}" height="20" fill="${glass}"/>`;
      if (r() > 0.75) s += `<rect x="${wx}" y="${wy}" width="${((w - 20) / cols - 12) / 2}" height="20" fill="#E9DEC8" opacity=".9"/>`;
    }
    for (let i = 0; i < rows; i += 2) s += `<rect x="${x - 4}" y="${top + 42 + i * 34}" width="${w + 8}" height="3" fill="${trim}" opacity=".9"/>`;
  }
  s += `<rect x="0" y="${ground}" width="800" height="80" fill="#CFC6B4"/><rect x="0" y="${ground}" width="800" height="6" fill="#B5AB97"/>`;
  s += trees(r, 6, ground + 4);
  return s;
}

function house(r: Rng, villa = false) {
  let s = sun(r);
  const ground = 500, w = villa ? between(r, 420, 520) : between(r, 300, 380), h = villa ? between(r, 200, 240) : between(r, 160, 210);
  const x = 400 - w / 2, top = ground - h, wall = pick(r, WALLS), roof = pick(r, ACCENT), glass = pick(r, GLASS);
  s += `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${wall}"/>`;
  if (r() > 0.5) s += `<path d="M${x - 20} ${top} L${400} ${top - 90} L${x + w + 20} ${top} Z" fill="${roof}"/>`;
  else s += `<rect x="${x - 16}" y="${top - 16}" width="${w + 32}" height="16" fill="${roof}"/>`;
  if (villa) {
    s += `<rect x="${x + w * 0.55}" y="${top - 80}" width="${w * 0.45}" height="80" fill="${pick(r, WALLS)}"/><rect x="${x + w * 0.58}" y="${top - 64}" width="${w * 0.38}" height="46" fill="${glass}"/>`;
  }
  s += `<rect x="${400 - 28}" y="${ground - 100}" width="56" height="100" fill="#5A4636"/><circle cx="${400 + 18}" cy="${ground - 50}" r="3" fill="#E7C98F"/>`;
  s += `<rect x="${x + 30}" y="${top + 40}" width="${w * 0.22}" height="70" fill="${glass}"/><rect x="${x + w - 30 - w * 0.22}" y="${top + 40}" width="${w * 0.22}" height="70" fill="${glass}"/>`;
  s += `<rect x="0" y="${ground}" width="800" height="100" fill="#A9B98F"/><rect x="${400 - 40}" y="${ground}" width="80" height="100" fill="#D8CDB8"/>`;
  s += trees(r, 4, ground + 2);
  return s;
}

function interior(r: Rng, room: "living" | "bed" | "kitchen") {
  const wall = pick(r, ["#EFE8DA", "#E6DCCB", "#DCE2DC", "#F1E4D8", "#E2E4E6"]);
  const floor = pick(r, ["#B8946C", "#A88462", "#C9B49A", "#9C8670"]);
  let s = `<rect width="800" height="600" fill="${wall}"/><rect y="440" width="800" height="160" fill="${floor}"/><rect y="436" width="800" height="6" fill="#00000014"/>`;
  const wx = between(r, 60, 460);
  s += `<rect x="${wx}" y="90" width="230" height="250" fill="#F7F4EE"/><rect x="${wx + 10}" y="100" width="210" height="230" fill="${pick(r, ["#BFD3D6", "#CFE0E0", "#E9D6BF"])}"/><rect x="${wx + 113}" y="100" width="4" height="230" fill="#F7F4EE"/>`;
  s += `<path d="M${wx + 10} 290 L${wx + 70} 250 L${wx + 120} 280 L${wx + 220} 230 L${wx + 220} 330 L${wx + 10} 330Z" fill="${pick(r, TREE)}" opacity=".6"/>`;
  if (room === "living") {
    const c = pick(r, ["#5B6770", "#C8664A", "#8FA392", "#3B4A54", "#B79B7A"]);
    s += `<rect x="150" y="470" width="500" height="70" rx="18" fill="#00000010"/>`;
    s += `<rect x="190" y="360" width="420" height="110" rx="22" fill="${c}"/><rect x="170" y="400" width="460" height="80" rx="20" fill="${c}"/><rect x="200" y="380" width="190" height="50" rx="14" fill="#ffffff22"/><rect x="410" y="380" width="190" height="50" rx="14" fill="#ffffff22"/>`;
    s += `<rect x="180" y="478" width="10" height="24" fill="#2B2B2B"/><rect x="610" y="478" width="10" height="24" fill="#2B2B2B"/>`;
    s += `<line x1="700" y1="200" x2="700" y2="470" stroke="#2B2B2B" stroke-width="4"/><path d="M670 200 L730 200 L715 160 L685 160Z" fill="#E9C98F"/>`;
    s += `<rect x="80" y="380" width="44" height="60" fill="#C9B9A2"/><ellipse cx="102" cy="360" rx="40" ry="50" fill="${pick(r, TREE)}"/>`;
  } else if (room === "bed") {
    const c = pick(r, ["#EDE7DC", "#DDE4E6", "#F0E2D0"]);
    s += `<rect x="200" y="300" width="400" height="120" rx="10" fill="${pick(r, ["#6E5A48", "#3B4A54", "#8C7A66"])}"/><rect x="190" y="400" width="420" height="90" rx="10" fill="${c}"/><rect x="190" y="440" width="420" height="50" rx="8" fill="${pick(r, ["#C8664A", "#8FA392", "#5B6770"])}"/><rect x="230" y="370" width="140" height="40" rx="14" fill="#FFFFFF"/><rect x="430" y="370" width="140" height="40" rx="14" fill="#FFFFFF"/>`;
    s += `<rect x="640" y="400" width="80" height="80" fill="#B79B7A"/><rect x="660" y="340" width="40" height="60" fill="#E9C98F"/>`;
  } else {
    const cab = pick(r, ["#5B6770", "#8FA392", "#EFE8DA", "#2F3A3F", "#C9B49A"]);
    s += `<rect x="0" y="330" width="800" height="120" fill="${cab}"/><rect x="0" y="320" width="800" height="14" fill="#E7E2D8"/>`;
    for (let i = 0; i < 8; i++) s += `<rect x="${10 + i * 100}" y="345" width="88" height="96" fill="#ffffff18"/><rect x="${45 + i * 100}" y="360" width="18" height="4" fill="#C9C2B5"/>`;
    s += `<rect x="0" y="40" width="${wx - 20}" height="120" fill="${cab}"/>`;
    for (let i = 0; i < 3; i++) s += `<line x1="${300 + i * 110}" y1="0" x2="${300 + i * 110}" y2="170" stroke="#2B2B2B" stroke-width="2"/><path d="M${280 + i * 110} 190 L${320 + i * 110} 190 L${310 + i * 110} 170 L${290 + i * 110} 170Z" fill="#2B2B2B"/>`;
    s += `<rect x="200" y="470" width="400" height="80" fill="${pick(r, ["#E7E2D8", "#D9D3C7"])}"/>`;
  }
  return s;
}

function office(r: Rng) {
  let s = sun(r);
  const ground = 530, x = between(r, 180, 260), w = 800 - 2 * x, top = between(r, 60, 140), glass = pick(r, GLASS);
  s += `<rect x="${x}" y="${top}" width="${w}" height="${ground - top}" fill="${glass}"/>`;
  for (let gx = x; gx < x + w; gx += 40) s += `<rect x="${gx}" y="${top}" width="3" height="${ground - top}" fill="#3B4A54" opacity=".6"/>`;
  for (let gy = top; gy < ground; gy += 30) s += `<rect x="${x}" y="${gy}" width="${w}" height="2" fill="#3B4A54" opacity=".5"/>`;
  s += `<path d="M${x} ${top + 60} L${x + w * 0.6} ${top} L${x + w * 0.75} ${top} L${x} ${top + 160}Z" fill="#fff" opacity=".25"/>`;
  s += `<rect x="${x - 10}" y="${ground - 60}" width="${w + 20}" height="60" fill="#2F3A3F"/><rect x="0" y="${ground}" width="800" height="70" fill="#CFC6B4"/>`;
  s += trees(r, 3, ground + 2);
  return s;
}

function shop(r: Rng) {
  const wall = pick(r, WALLS), a1 = pick(r, ["#C8664A", "#2F3A3F", "#5F7A5E"]);
  let s = `<rect y="80" width="800" height="460" fill="${wall}"/>`;
  s += `<rect x="80" y="180" width="640" height="34" fill="#23262B"/><text x="400" y="204" font-family="Georgia,serif" font-size="20" fill="#F3EEE4" text-anchor="middle" letter-spacing="6">SHOWROOM</text>`;
  for (let i = 0; i < 16; i++) s += `<path d="M${80 + i * 40} 214 L${120 + i * 40} 214 L${120 + i * 40} 250 Q${100 + i * 40} 266 ${80 + i * 40} 250Z" fill="${i % 2 ? a1 : "#F3EEE4"}"/>`;
  s += `<rect x="100" y="270" width="600" height="250" fill="${pick(r, GLASS)}"/><rect x="370" y="300" width="60" height="220" fill="#3B3330"/><rect y="520" width="800" height="80" fill="#BDB4A2"/>`;
  return s;
}

function plot(r: Rng) {
  let s = sun(r);
  s += `<path d="M0 330 Q200 300 400 320 T800 310 L800 600 L0 600Z" fill="#A9B98F"/>`;
  for (let i = 0; i < 9; i++) s += `<path d="M0 ${360 + i * 28} Q400 ${340 + i * 30} 800 ${355 + i * 28}" stroke="#97A87D" stroke-width="6" fill="none"/>`;
  s += `<path d="M180 380 L640 380 L720 560 L90 560Z" fill="none" stroke="#F3EEE4" stroke-width="4" stroke-dasharray="14 10"/>`;
  for (const [x, y] of [[180, 380], [640, 380], [720, 560], [90, 560]]) s += `<rect x="${x - 6}" y="${y - 16}" width="12" height="18" fill="#E9E2D3"/>`;
  s += trees(r, 3, 330);
  return s;
}

function warehouse(r: Rng) {
  let s = sun(r);
  const ground = 520, wall = pick(r, ["#8FA392", "#B9A48A", "#7D8A84", "#D9C3A5"]), roof = pick(r, ACCENT);
  const x = between(r, 70, 110), w = 800 - 2 * x, top = 250;
  s += `<rect x="${x}" y="${top}" width="${w}" height="${ground - top}" fill="${wall}"/>`;
  s += `<path d="M${x - 14} ${top} L${x + w * 0.5} ${top - 70} L${x + w + 14} ${top}Z" fill="${roof}"/>`;
  for (let i = 0; i < 12; i++) s += `<rect x="${x}" y="${top + 8 + i * 4}" width="${w}" height="1.5" fill="#00000012"/>`;
  const doors = 3, dw = 120, gap = (w - doors * dw) / (doors + 1);
  for (let i = 0; i < doors; i++) {
    const dx = x + gap + i * (dw + gap);
    s += `<rect x="${dx}" y="${ground - 150}" width="${dw}" height="150" fill="#3B4A54"/>`;
    for (let k = 0; k < 7; k++) s += `<rect x="${dx}" y="${ground - 150 + k * 21}" width="${dw}" height="2" fill="#ffffff22"/>`;
  }
  s += `<rect x="${x}" y="${top + 24}" width="${w}" height="26" fill="#2F3A3F"/><text x="400" y="${top + 43}" font-family="Helvetica,Arial" font-size="16" fill="#E7E2D8" text-anchor="middle" letter-spacing="8">GODOWN</text>`;
  s += `<rect x="0" y="${ground}" width="800" height="80" fill="#CFC6B4"/><rect x="0" y="${ground}" width="800" height="6" fill="#B5AB97"/>`;
  s += trees(r, 3, ground + 4);
  return s;
}

function floorplan(r: Rng) {
  let s = `<rect width="800" height="600" fill="#FBFAF7"/>`;
  const g = "#2B2F33";
  s += `<rect x="100" y="80" width="600" height="440" fill="none" stroke="${g}" stroke-width="8"/>`;
  const vx = between(r, 300, 380), hy = between(r, 260, 320);
  s += `<line x1="${vx}" y1="80" x2="${vx}" y2="${hy}" stroke="${g}" stroke-width="5"/><line x1="100" y1="${hy}" x2="700" y2="${hy}" stroke="${g}" stroke-width="5"/><line x1="560" y1="${hy}" x2="560" y2="520" stroke="${g}" stroke-width="5"/>`;
  s += `<rect x="${vx - 40}" y="${hy - 3}" width="50" height="6" fill="#FBFAF7"/><rect x="460" y="${hy - 3}" width="50" height="6" fill="#FBFAF7"/>`;
  const t = (x: number, y: number, a: string, b: string) => `<text x="${x}" y="${y}" font-family="Helvetica,Arial" font-size="18" fill="${g}" text-anchor="middle" font-weight="600">${a}</text><text x="${x}" y="${y + 22}" font-family="Helvetica,Arial" font-size="13" fill="#6B6F73" text-anchor="middle">${b}</text>`;
  s += t((100 + vx) / 2, (80 + hy) / 2, "BEDROOM", "12' × 11'") + t((vx + 700) / 2, (80 + hy) / 2, "MASTER BEDROOM", "14' × 12'") + t(330, (hy + 520) / 2, "LIVING / DINING", "20' × 13'") + t(630, (hy + 520) / 2, "KITCHEN", "9' × 8'");
  return s;
}

export type ArtKind = "warehouse" | "tower" | "house" | "villa" | "living" | "bed" | "kitchen" | "office" | "shop" | "plot" | "floorplan";
export const ART_KINDS: ArtKind[] = ["warehouse", "tower", "house", "villa", "living", "bed", "kitchen", "office", "shop", "plot", "floorplan"];

export function renderArt(kind: ArtKind, seed: number): string {
  const r = mulberry(seed * 9973 + kind.length * 131);
  const sky = pick(r, SKIES);
  switch (kind) {
    case "tower": return wrap(tower(r), sky);
    case "house": return wrap(house(r), sky);
    case "villa": return wrap(house(r, true), sky);
    case "living": return wrap(interior(r, "living"), sky);
    case "bed": return wrap(interior(r, "bed"), sky);
    case "kitchen": return wrap(interior(r, "kitchen"), sky);
    case "office": return wrap(office(r), sky);
    case "shop": return wrap(shop(r), sky);
    case "plot": return wrap(plot(r), sky);
    case "warehouse": return wrap(warehouse(r), sky);
    case "floorplan": return wrap(floorplan(r), sky);
  }
}

export const artUrl = (kind: ArtKind, seed: number) => `/api/art/${kind}/${seed}`;
