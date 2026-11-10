/* eslint-disable @typescript-eslint/no-explicit-any */
// Seeds a realistic demo marketplace. Run: npm run seed  (wipes data/10cent.db)
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "../src/lib/schema";

const DATA = path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA, "10cent.db");
fs.mkdirSync(path.join(DATA, "uploads"), { recursive: true });
for (const ext of ["", "-wal", "-shm"]) if (fs.existsSync(DB_PATH + ext)) fs.unlinkSync(DB_PATH + ext);
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA);

let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
const chance = (p: number) => rnd() < p;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000 - int(0, 86000) * 1000).toISOString();
const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const round = (n: number, to: number) => Math.round(n / to) * to;

// ---------------------------------------------------------------- cities & localities
type Loc = [name: string, lat: number, lng: number, psf: number, rating: number];
const CITIES: Array<{ slug: string; name: string; state: string; lat: number; lng: number; launch: number; locs: Loc[]; rentFactor: number }> = [
  { slug: "bengaluru", name: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946, launch: 1, rentFactor: 0.0033, locs: [
    ["Whitefield", 12.9698, 77.75, 8200, 4.2], ["Koramangala", 12.9352, 77.6245, 14500, 4.6], ["HSR Layout", 12.9116, 77.6474, 12000, 4.5],
    ["Indiranagar", 12.9784, 77.6408, 16000, 4.6], ["Electronic City", 12.8452, 77.6602, 6200, 3.9], ["Sarjapur Road", 12.901, 77.687, 7800, 4.1],
    ["Hebbal", 13.0358, 77.597, 10500, 4.3], ["JP Nagar", 12.9063, 77.5857, 9800, 4.4], ["Yelahanka", 13.1007, 77.5963, 6900, 4.0], ["Bellandur", 12.926, 77.6762, 9200, 4.1],
  ]},
  { slug: "mumbai", name: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777, launch: 1, rentFactor: 0.0026, locs: [
    ["Andheri West", 19.1364, 72.8296, 26000, 4.4], ["Powai", 19.1176, 72.906, 24000, 4.5], ["Bandra West", 19.0596, 72.8295, 52000, 4.7],
    ["Thane West", 19.2183, 72.9781, 14500, 4.3], ["Goregaon East", 19.1663, 72.8526, 21000, 4.2], ["Kharghar", 19.033, 73.0297, 11000, 4.1],
    ["Chembur", 19.0522, 72.9005, 23000, 4.3], ["Malad West", 19.1874, 72.8484, 20000, 4.1],
  ]},
  { slug: "pune", name: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567, launch: 1, rentFactor: 0.0031, locs: [
    ["Hinjewadi", 18.5913, 73.7389, 7400, 4.0], ["Kharadi", 18.5515, 73.9348, 9300, 4.3], ["Baner", 18.559, 73.7868, 10500, 4.4],
    ["Wakad", 18.5989, 73.765, 8100, 4.1], ["Viman Nagar", 18.5679, 73.9143, 11500, 4.5], ["Kothrud", 18.5074, 73.8077, 12500, 4.5],
    ["Hadapsar", 18.5089, 73.926, 7200, 3.9], ["Aundh", 18.558, 73.8075, 12000, 4.4],
  ]},
  { slug: "hyderabad", name: "Hyderabad", state: "Telangana", lat: 17.385, lng: 78.4867, launch: 0, rentFactor: 0.0032, locs: [
    ["Gachibowli", 17.4401, 78.3489, 9500, 4.4], ["Kondapur", 17.46, 78.357, 8600, 4.3], ["Madhapur", 17.4483, 78.3915, 10200, 4.4],
    ["Kukatpally", 17.4948, 78.3996, 7100, 4.0], ["Banjara Hills", 17.4156, 78.4347, 14500, 4.6], ["Kokapet", 17.396, 78.332, 9800, 4.2],
    ["Miyapur", 17.4968, 78.3614, 6400, 3.9], ["Begumpet", 17.4447, 78.4664, 9000, 4.2],
  ]},
  { slug: "gurugram", name: "Gurugram", state: "Haryana", lat: 28.4595, lng: 77.0266, launch: 0, rentFactor: 0.0028, locs: [
    ["Golf Course Extension Road", 28.4011, 77.0745, 15500, 4.4], ["DLF Phase 3", 28.4931, 77.0937, 13500, 4.3], ["Sohna Road", 28.4089, 77.0418, 10200, 4.1],
    ["Dwarka Expressway", 28.51, 77.005, 11200, 4.1], ["Sector 56", 28.4229, 77.1018, 12800, 4.2], ["New Gurgaon", 28.422, 76.96, 8200, 3.9], ["MG Road", 28.4796, 77.0806, 14200, 4.3],
  ]},
  { slug: "chennai", name: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707, launch: 0, rentFactor: 0.0031, locs: [
    ["Sholinganallur", 12.901, 80.2279, 7600, 4.1], ["Velachery", 12.9815, 80.218, 9200, 4.3], ["Anna Nagar", 13.085, 80.2101, 14000, 4.6],
    ["Adyar", 13.0012, 80.2565, 16500, 4.6], ["Porur", 13.0382, 80.1565, 7000, 4.0], ["Tambaram", 12.9249, 80.1, 5600, 3.9], ["Perungudi", 12.9654, 80.2461, 8200, 4.1], ["T Nagar", 13.0418, 80.2341, 17000, 4.5],
  ]},
];

const LANDMARK_KINDS = [
  ["metro", ["Metro Station", "Metro"]],
  ["school", ["International School", "Public School", "Vidya Mandir"]],
  ["hospital", ["Multispeciality Hospital", "Medical Centre", "Hospital"]],
  ["mall", ["Mall", "Market"]],
  ["it_park", ["Tech Park", "IT Park"]],
] as const;

const insCity = db.prepare("INSERT INTO cities (slug, name, state, lat, lng, is_launch, sort) VALUES (?,?,?,?,?,?,?)");
const insLoc = db.prepare("INSERT INTO localities (city_id, slug, name, lat, lng, rating, connectivity, safety, lifestyle, description, landmarks, trending) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
const insTrend = db.prepare("INSERT INTO price_trends (locality_id, month, avg_price_sqft, avg_rent_2bhk) VALUES (?,?,?,?)");

type LocRow = { id: number; cityId: number; cityIdx: number; name: string; lat: number; lng: number; psf: number; rentFactor: number; state: string; city: string };
const LOCS: LocRow[] = [];
CITIES.forEach((c, ci) => {
  const cityId = Number(insCity.run(c.slug, c.name, c.state, c.lat, c.lng, c.launch, ci).lastInsertRowid);
  c.locs.forEach(([name, lat, lng, psf, rating], li) => {
    const landmarks = LANDMARK_KINDS.flatMap(([kind, names]) =>
      Array.from({ length: kind === "school" || kind === "hospital" ? 2 : 1 }, () => ({
        name: `${name.split(" ")[0]} ${pick(names)}`,
        kind,
        lat: +(lat + (rnd() - 0.5) * 0.02).toFixed(5),
        lng: +(lng + (rnd() - 0.5) * 0.02).toFixed(5),
      }))
    );
    const desc = `${name} is ${rating >= 4.4 ? "one of the most sought-after addresses" : "a fast-growing residential pocket"} in ${c.name}, known for ${pick(["its tree-lined streets and established social infrastructure", "quick access to the city's major employment hubs", "a balanced mix of gated communities and independent homes", "good schools, hospitals and daily-needs retail within a short drive"])}. ${pick(["Upcoming metro connectivity is expected to support prices.", "Most housing stock here is mid-rise apartments built in the last decade.", "Rental demand is steady thanks to nearby offices.", "Weekend traffic is manageable, but peak-hour commutes can be slow."])}`;
    const locId = Number(insLoc.run(cityId, slug(name), name, lat, lng, rating, +(rating - 0.3 + rnd() * 0.6).toFixed(1), +(rating - 0.2 + rnd() * 0.4).toFixed(1), +(rating - 0.4 + rnd() * 0.6).toFixed(1), desc, JSON.stringify(landmarks), li < 3 ? 1 : 0).lastInsertRowid);
    LOCS.push({ id: locId, cityId, cityIdx: ci, name, lat, lng, psf, rentFactor: c.rentFactor, state: c.state, city: c.name });
    // 36 months of price trend, ending at current psf with mild growth + noise.
    const growth = 0.004 + rnd() * 0.006;
    for (let m = 35; m >= 0; m--) {
      const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - m);
      const p = psf / Math.pow(1 + growth, m) * (1 + (rnd() - 0.5) * 0.02);
      const rent = p * 1000 * c.rentFactor * (1 + (rnd() - 0.5) * 0.03);
      insTrend.run(locId, d.toISOString().slice(0, 7), Math.round(p), round(rent, 500));
    }
  });
});

// ---------------------------------------------------------------- users
const insUser = db.prepare("INSERT INTO users (phone, email, name, role, admin_role, kyc_status, created_at, free_listing_limit) VALUES (?,?,?,?,?,?,?,?)");
const insProfile = db.prepare("INSERT INTO profiles (user_id, company_name, rera_number, experience_years, established_year, about, city_id, rating, rating_count, gstin) VALUES (?,?,?,?,?,?,?,?,?,?)");
const insPrefs = db.prepare("INSERT INTO notification_prefs (user_id) VALUES (?)");
const mkUser = (phone: string, name: string, role: string, opts: { email?: string; admin?: string; kyc?: string; days?: number; limit?: number } = {}) => {
  const id = Number(insUser.run(phone, opts.email ?? null, name, role, opts.admin ?? null, opts.kyc ?? "none", iso(opts.days ?? int(30, 900)), opts.limit ?? 3).lastInsertRowid);
  insPrefs.run(id);
  return id;
};

const FIRST = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Rohan", "Karthik", "Siddharth", "Arjun", "Rahul", "Nikhil", "Priya", "Ananya", "Diya", "Meera", "Kavya", "Sneha", "Pooja", "Lakshmi", "Neha", "Shreya", "Farhan", "Imran", "Joseph", "Gurpreet", "Harish", "Venkat", "Suresh", "Deepa", "Anjali", "Ritu"];
const LAST = ["Sharma", "Iyer", "Reddy", "Nair", "Patil", "Kulkarni", "Gupta", "Menon", "Rao", "Singh", "Joshi", "Desai", "Khan", "Fernandes", "Pillai", "Chatterjee", "Bhat", "Agarwal", "Shetty", "Mehta"];
const person = () => `${pick(FIRST)} ${pick(LAST)}`;
let phoneSeq = 7000000100;
const nextPhone = () => String(phoneSeq++);

// Staff (PRD AD1 roles)
const adminId = mkUser("9000000001", "Asha Krishnan", "admin", { admin: "super", email: "asha@10cent.in", days: 400 });
mkUser("9000000002", "Manoj Pillai", "admin", { admin: "moderator", email: "manoj@10cent.in", days: 380 });
mkUser("9000000003", "Fatima Sheikh", "admin", { admin: "support", email: "fatima@10cent.in", days: 300 });
mkUser("9000000004", "Rakesh Bansal", "admin", { admin: "sales", email: "rakesh@10cent.in", days: 260 });
mkUser("9000000005", "Leela Varma", "admin", { admin: "content", email: "leela@10cent.in", days: 200 });

// Demo accounts the team can sign into
const demoOwner = mkUser("9876543210", "Neha Kulkarni", "owner", { email: "neha.owner@example.com", kyc: "verified", days: 220 });
const demoAgent = mkUser("9876543211", "Vikram Shetty", "agent", { email: "vikram@shettyrealty.example", kyc: "verified", days: 700, limit: 50 });
insProfile.run(demoAgent, "Shetty Realty", "PRM/KA/RERA/1251/310/AG/220415/002914", 11, null, "Resale and rental specialist for east Bengaluru since 2014. We handle documentation, home loans and registration end-to-end.", 1, 4.6, 87, "29ABCDE1234F1Z5");
const demoBuilder = mkUser("9876543212", "Sanjay Rao", "builder", { email: "sales@banyanbrick.example", kyc: "verified", days: 900, limit: 200 });
const demoSeeker = mkUser("9876543213", "Ishaan Mehta", "seeker", { email: "ishaan@example.com", days: 60 });

const owners: number[] = [demoOwner];
for (let i = 0; i < 70; i++) owners.push(mkUser(nextPhone(), person(), "owner", { kyc: chance(0.3) ? "verified" : "none" }));

const AGENCIES = ["Keystone Realty", "Lotus Property Advisors", "Northstar Homes", "Anchor Estates", "Banyan Brokers", "Harbour Realty", "Square Feet Consultants", "Doorstep Properties", "Urban Nest Realtors", "Trident Realty", "Bluebell Estates", "Gateway Property Services", "Silverline Realty", "Peak Advisors", "Courtyard Realtors"];
const agents: Array<{ id: number; city: number }> = [{ id: demoAgent, city: 0 }];
AGENCIES.forEach((a, i) => {
  const id = mkUser(nextPhone(), person(), "agent", { kyc: chance(0.6) ? "verified" : "pending", limit: 50 });
  const ci = i % CITIES.length;
  insProfile.run(id, a, chance(0.8) ? `AG/${CITIES[ci].state.slice(0, 2).toUpperCase()}/${int(1000, 9999)}/${int(2018, 2025)}` : null, int(2, 22), null, `${a} helps families find homes across ${CITIES[ci].name}. Verified listings, transparent commission.`, ci + 1, +(3.6 + rnd() * 1.3).toFixed(1), int(5, 140), null);
  agents.push({ id, city: ci });
});

const BUILDERS = [
  ["Banyan & Brick Developers", 0], ["Saptagiri Constructions", 0], ["Monsoon Realty", 1], ["Coastline Builders", 1], ["Sahyadri Developers", 2],
  ["Deccan Crest Homes", 3], ["Redstone Infra", 4], ["Kaveri Living", 0], ["Tamarind Estates", 5], ["Indigo Habitat", 2], ["Nilgiri Homes", 5], ["Aranya Developers", 3],
] as const;
const builders: Array<{ id: number; name: string; city: number }> = [];
BUILDERS.forEach(([name, ci], i) => {
  const id = i === 0 ? demoBuilder : mkUser(nextPhone(), person(), "builder", { kyc: "verified", limit: 200 });
  const est = int(1992, 2015);
  insProfile.run(id, name, null, 2026 - est, est, `${name} has delivered ${int(6, 40)} projects and over ${int(3, 25) * 1000} homes since ${est}. We build mid-rise and high-rise communities with a focus on daylight, ventilation and on-time handover.`, ci + 1, +(3.8 + rnd() * 1.0).toFixed(1), int(10, 300), `${int(10, 36)}AAB${String.fromCharCode(65 + i)}${int(1000, 9999)}C1Z${i}`);
  builders.push({ id, name, city: ci });
});

const seekers: number[] = [demoSeeker];
for (let i = 0; i < 40; i++) seekers.push(mkUser(nextPhone(), person(), "seeker"));

// ---------------------------------------------------------------- projects
const PROJECT_WORDS = ["Grove", "Heights", "Residences", "Park", "Crest", "Meadows", "Courtyard", "Terraces", "Gardens", "Vista", "Enclave", "One"];
const PROJECT_PREFIX = ["Aura", "Tara", "Vana", "Neel", "Surya", "Amara", "Ira", "Kosha", "Sita", "Megh", "Prana", "Ruhi", "Dhara", "Avani", "Saanvi", "Ojas", "Tarang", "Vriksha"];
const AMENITY_ALL = ["parking", "lift", "gym", "pool", "power_backup", "security", "clubhouse", "park", "play_area", "cctv", "gas_pipeline", "rainwater", "intercom"];
const insProj = db.prepare(`INSERT INTO projects (builder_id, name, slug, city_id, locality_id, address, lat, lng, rera_id, rera_state, status, launch_date, possession_date, total_units, land_area_acres, description, price_min, price_max, amenities, location_advantages, featured, sponsored, brochure_url, master_plan_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insTower = db.prepare("INSERT INTO project_towers (project_id, name, floors, units, completion_pct) VALUES (?,?,?,?,?)");
const insUnit = db.prepare("INSERT INTO project_unit_types (project_id, label, bhk, carpet_area, super_area, price, floor_plan_url, available_units) VALUES (?,?,?,?,?,?,?,?)");
const insPMedia = db.prepare("INSERT INTO project_media (project_id, kind, url, sort) VALUES (?,?,?,?)");

const reraId = (state: string) => {
  switch (state) {
    case "Karnataka": return `PRM/KA/RERA/1251/${int(300, 480)}/PR/${int(200101, 251231)}/00${int(1000, 9999)}`;
    case "Maharashtra": return `P5${int(1000, 2999)}00${int(10000, 99999)}`;
    case "Telangana": return `P0${int(2000, 2499)}000${int(1000, 9999)}`;
    case "Haryana": return `RC/REP/HARERA/GGM/${int(2021, 2025)}/${int(10, 99)}`;
    default: return `TN/${int(1, 40)}/Building/0${int(100, 999)}/${int(2021, 2025)}`;
  }
};

type Proj = { id: number; builderId: number; loc: LocRow; units: Array<{ bhk: number; carpet: number; superA: number; price: number }>; status: string; possession: string; rera: string; name: string };
const projects: Proj[] = [];
let pSeq = 0;
for (const b of builders) {
  const count = b.id === demoBuilder ? 3 : int(1, 2);
  for (let k = 0; k < count; k++) {
    const ci = k === 0 ? b.city : int(0, CITIES.length - 1);
    const cityLocs = LOCS.filter((l) => l.cityIdx === ci);
    const loc = pick(cityLocs);
    const name = `${b.name.split(" ")[0].replace("&", "")} ${PROJECT_PREFIX[pSeq % PROJECT_PREFIX.length]} ${pick(PROJECT_WORDS)}`.replace("Banyan", "Banyan");
    pSeq++;
    const status = pick(["new_launch", "under_construction", "under_construction", "ready"]);
    const possession = status === "ready" ? iso(int(30, 400)).slice(0, 10) : future(int(200, 1300)).slice(0, 10);
    const unitTypes = [2, 3, ...(chance(0.6) ? [4] : []), ...(chance(0.4) ? [1] : [])].sort();
    const psf = loc.psf * (status === "new_launch" ? 0.92 : 1) * (1 + (rnd() - 0.4) * 0.15);
    const units = unitTypes.map((bhk) => {
      const carpet = round(bhk * 430 + int(60, 260), 5);
      const superA = round(carpet * 1.32, 5);
      return { bhk, carpet, superA, price: round(superA * psf, 50000) };
    });
    const lat = +(loc.lat + (rnd() - 0.5) * 0.012).toFixed(6), lng = +(loc.lng + (rnd() - 0.5) * 0.012).toFixed(6);
    const rera = reraId(loc.state);
    const totalUnits = int(180, 1400);
    const amen = AMENITY_ALL.filter(() => chance(0.75));
    const adv = [
      { name: `${loc.name} Metro Station`, distance: `${(rnd() * 3 + 0.4).toFixed(1)} km` },
      { name: `${loc.city} International Airport`, distance: `${int(14, 42)} km` },
      { name: `${pick(["Global", "Greenwood", "Delhi Public", "National"])} School`, distance: `${(rnd() * 2 + 0.3).toFixed(1)} km` },
      { name: `${pick(["Apollo-style", "City", "Sunrise"])} Hospital`, distance: `${(rnd() * 4 + 0.6).toFixed(1)} km` },
      { name: `${loc.name} ${pick(["Tech Park", "Business Park", "Mall"])}`, distance: `${(rnd() * 5 + 0.5).toFixed(1)} km` },
    ];
    const desc = `${name} is a ${status === "ready" ? "ready-to-move" : status === "new_launch" ? "newly launched" : "under-construction"} residential community by ${b.name} in ${loc.name}, ${loc.city}. Spread across ${(rnd() * 8 + 2).toFixed(1)} acres with ${totalUnits} homes in ${unitTypes.map((u) => `${u} BHK`).join(", ")} configurations, the project keeps more than 70% of the land open, with a central landscaped court, a 30,000 sq ft clubhouse and cross-ventilated layouts with no two units sharing a wall.\n\nEvery home gets vitrified flooring in living areas, engineered wood in the master bedroom, a utility balcony and provision for split ACs. ${loc.name} is well connected to the city's office corridors, with schools and hospitals inside a 3 km radius.`;
    const id = Number(insProj.run(b.id, name, slug(name), loc.cityId, loc.id, `${loc.name}, ${loc.city}`, lat, lng, rera, loc.state, status, iso(int(60, 900)).slice(0, 10), possession, totalUnits, +(rnd() * 8 + 2).toFixed(1), desc, Math.min(...units.map((u) => u.price)), Math.max(...units.map((u) => u.price)), JSON.stringify(amen), JSON.stringify(adv), chance(0.45) ? 1 : 0, chance(0.25) ? 1 : 0, null, `/api/art/floorplan/${2000 + pSeq}`, iso(int(30, 600))).lastInsertRowid);
    const towers = int(2, 6);
    for (let t = 0; t < towers; t++) insTower.run(id, `Tower ${String.fromCharCode(65 + t)}`, int(14, 34), int(60, 240), status === "ready" ? 100 : status === "new_launch" ? int(0, 15) : int(25, 90));
    units.forEach((u) => insUnit.run(id, `${u.bhk} BHK`, u.bhk, u.carpet, u.superA, u.price, `/api/art/floorplan/${id * 10 + u.bhk}`, int(4, 60)));
    ["tower", "tower", "living", "bed", "kitchen", "villa"].forEach((k, i) => insPMedia.run(id, "photo", `/api/art/${k}/${id * 7 + i}`, i));
    projects.push({ id, builderId: b.id, loc, units, status, possession, rera, name });
  }
}

// ---------------------------------------------------------------- listings
const insL = db.prepare(`INSERT INTO listings (user_id, posted_by_type, title, transaction_type, category, property_type, city_id, locality_id, project_id, address, lat, lng, price, price_negotiable, maintenance, deposit, bhk, bathrooms, balconies, carpet_area, builtup_area, super_area, plot_area, floor, total_floors, facing, age_years, furnishing, construction_status, possession_date, new_launch, rera_id, verified, tenant_types, available_from, pg_sharing, pg_meals, description, status, reject_reason, featured, premium, boost, views, dup_hash, created_at, updated_at, published_at, expires_at, auto_flags) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insM = db.prepare("INSERT INTO listing_media (listing_id, kind, url, sort) VALUES (?,?,?,?)");
const insA = db.prepare("INSERT OR IGNORE INTO listing_amenities (listing_id, amenity) VALUES (?,?)");
const insStat = db.prepare("INSERT OR REPLACE INTO listing_stats (listing_id, day, impressions, views, contacts, shortlists) VALUES (?,?,?,?,?,?)");
const insMod = db.prepare("INSERT INTO moderation_logs (listing_id, actor_id, action, reason, created_at) VALUES (?,?,?,?,?)");

const FACINGS = ["North", "South", "East", "West", "North-East", "North-West", "South-East", "South-West"];
const SOCIETY = ["Prestige-style", "Green Acres", "Lakeview", "Palm Meadows", "Silver Oak", "Rosewood", "Maple Court", "Sunrise Towers", "Orchid Residency", "Shanti Kunj", "Brigade Lane", "Ashoka Apartments", "Coral Heights", "Laurel Park", "Sai Krupa", "Vasant Vihar Society"];

function descFor(o: any) {
  const lines: string[] = [];
  if (o.tx === "pg") {
    lines.push(`Well-kept ${o.pgFor} PG in ${o.loc.name} with ${o.sharing} sharing rooms, ${o.meals ? "three home-style meals a day" : "a shared kitchen"}, Wi-Fi, housekeeping and power backup.`);
    lines.push(`Walking distance to bus stops and offices around ${o.loc.name}. Biometric entry, CCTV and a resident warden. No brokerage.`);
    return lines.join("\n\n");
  }
  if (o.type === "plot") {
    lines.push(`${o.area} sq ft ${o.facing}-facing plot in a gated layout at ${o.loc.name}, with clear title, approved plan and ready access road.`);
    lines.push(`Underground drainage, water and electricity lines in place. Ideal for building an independent home or a villa. Bank loans available.`);
    return lines.join("\n\n");
  }
  if (o.cat === "commercial") {
    lines.push(`${o.area} sq ft ${o.type === "office" ? "office space" : o.type === "shop" ? "ground-floor retail shop" : "warehouse"} in ${o.loc.name} with ${o.type === "office" ? "plug-and-play fit-outs, 2 meeting rooms, pantry and dedicated parking" : o.type === "shop" ? "wide frontage on a busy main road, good footfall and signage rights" : "26 ft clear height, truck access and 3-phase power"}.`);
    lines.push(`Suitable for ${o.type === "office" ? "IT/ITES, startups and back offices" : o.type === "shop" ? "showroom, clinic, bank or café" : "e-commerce, storage and light manufacturing"}. Clear documentation; available immediately.`);
    return lines.join("\n\n");
  }
  lines.push(`${o.furnishing === "furnished" ? "Fully furnished" : o.furnishing === "semi" ? "Semi-furnished" : "Unfurnished"} ${o.bhk} BHK ${o.type === "apartment" ? `apartment on the ${o.floor}${["th", "st", "nd", "rd"][o.floor % 10] ?? "th"} floor of ${o.society}` : o.type === "villa" ? "villa in a gated community" : "independent house"} in ${o.loc.name}. ${o.facing}-facing with ${pick(["excellent cross ventilation", "lots of natural light", "an open view of the park", "a quiet, tree-lined approach"])}.`);
  lines.push(`${o.bhk} bedrooms, ${o.bath} bathrooms and ${o.balc} balcon${o.balc === 1 ? "y" : "ies"}. ${o.furnishing !== "unfurnished" ? "Modular kitchen with chimney, wardrobes in all bedrooms, ACs in the master bedroom and living room. " : ""}${pick(["Covered car parking included.", "One covered and one open parking.", "Visitor parking available."])}`);
  if (o.tx === "rent") lines.push(`Preferred tenants: ${o.tenants.join(", ")}. ${o.deposit} months' deposit. Maintenance ${o.maintenance ? `₹${o.maintenance.toLocaleString("en-IN")}` : "included"}. Available from ${new Date(o.avail).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`);
  else lines.push(`${o.cs === "ready" ? `Ready to move, ${o.age} year${o.age === 1 ? "" : "s"} old.` : `Possession by ${new Date(o.possession).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}.`} Clear title, ${pick(["OC and CC received", "A-khata", "all approvals in place", "bank-approved for home loans"])}. ${o.negotiable ? "Price slightly negotiable for serious buyers." : ""}`);
  return lines.join("\n\n");
}

const listingOwners: Record<number, number[]> = {};
let listingCount = 0;
let dupSource: any = null;

function makeListing(opts: { userId: number; by: "owner" | "agent" | "builder"; loc: LocRow; tx?: string; cat?: string; type?: string; project?: Proj; status?: string; daysAgo?: number }) {
  const { loc } = opts;
  const r = rnd();
  const tx = opts.tx ?? (r < 0.55 ? "sell" : r < 0.88 ? "rent" : "pg");
  const cat = tx === "pg" ? "residential" : opts.cat ?? "residential";
  let type = opts.type ?? (tx === "pg" ? "pg" : pick(["apartment", "apartment", "apartment", "apartment", "house", "villa", ...(tx === "sell" ? ["plot"] : [])]));
  if (cat === "commercial") type = opts.type ?? pick(["office", "office", "shop", "warehouse"]);
  const p = opts.project;
  let bhk: number | null = null, bath: number | null = null, balc: number | null = null, carpet: number | null = null, superA: number | null = null, builtup: number | null = null, plotA: number | null = null;
  let price = 0;
  const psf = loc.psf * (1 + (rnd() - 0.5) * 0.25);
  if (p) {
    const u = pick(p.units);
    bhk = u.bhk; carpet = u.carpet; superA = u.superA; price = u.price; bath = Math.min(bhk + 1, bhk === 1 ? 1 : bhk); balc = int(1, 3);
  } else if (type === "pg") {
    bhk = null; carpet = int(110, 220);
    price = round(loc.psf * 0.9 + int(4000, 9000), 500);
  } else if (type === "plot") {
    plotA = pick([1200, 1500, 2400, 3000, 4000]);
    price = round(plotA * psf * 0.75, 50000);
  } else if (cat === "commercial") {
    carpet = type === "office" ? int(6, 60) * 100 : type === "shop" ? int(2, 15) * 100 : int(40, 250) * 100;
    superA = round(carpet * 1.3, 10);
    price = tx === "rent" ? round(carpet * (type === "warehouse" ? 28 : psf * 0.0065), 1000) : round(superA * psf * (type === "warehouse" ? 0.4 : 1.15), 100000);
  } else {
    bhk = type === "villa" ? int(3, 5) : type === "house" ? int(2, 5) : pick([1, 2, 2, 2, 3, 3, 3, 4]);
    carpet = round(bhk * int(380, 520) + int(50, 200), 5) * (type === "apartment" ? 1 : 1.6);
    carpet = Math.round(carpet);
    superA = round(carpet * 1.3, 5);
    bath = Math.max(1, bhk - (chance(0.3) ? 1 : 0));
    balc = int(1, 3);
    if (type !== "apartment") { builtup = round(carpet * 1.15, 5); superA = null; plotA = round(carpet * 0.8, 10); }
    price = tx === "rent" ? round((superA ?? builtup ?? carpet) * psf * loc.rentFactor * 0.9, 500) : round((superA ?? builtup ?? carpet) * psf, 50000);
  }
  const floorTotal = type === "apartment" ? int(4, 32) : type === "house" ? int(1, 3) : type === "villa" ? int(2, 3) : cat === "commercial" ? int(1, 12) : null;
  const floor = floorTotal ? int(0, floorTotal) : null;
  const facing = pick(FACINGS);
  const furnishing = type === "plot" ? null : tx === "pg" ? "furnished" : pick(["unfurnished", "semi", "semi", "furnished"]);
  const cs = tx === "sell" && type !== "plot" ? (p ? (p.status === "ready" ? "ready" : "under_construction") : chance(0.85) ? "ready" : "under_construction") : null;
  const possession = cs === "under_construction" ? (p?.possession ?? future(int(200, 1100)).slice(0, 10)) : null;
  const age = cs === "ready" || tx !== "sell" ? (p ? 0 : int(0, 15)) : null;
  const tenants = tx === "rent" ? (["family", "bachelor", "company"].filter(() => chance(0.6)).length ? ["family", "bachelor", "company"].filter(() => chance(0.6)) : ["family"]) : tx === "pg" ? [pick(["girls", "boys"])] : [];
  const avail = tx !== "sell" ? (chance(0.5) ? new Date().toISOString().slice(0, 10) : future(int(5, 60)).slice(0, 10)) : null;
  const sharing = tx === "pg" ? pick(["single", "double", "triple", "single,double", "double,triple"]) : null;
  const meals = tx === "pg" ? (chance(0.7) ? 1 : 0) : null;
  const society = pick(SOCIETY);
  const negotiable = chance(0.35) ? 1 : 0;
  const maintenance = tx === "rent" && chance(0.7) ? round(int(1500, 7000), 100) : tx === "sell" && type === "apartment" ? round((superA ?? 1000) * int(2, 5), 100) : null;
  const deposit = tx === "rent" ? (cat === "commercial" ? int(6, 10) : int(2, 6)) : tx === "pg" ? 1 : null;
  const lat = +((p?.loc.lat ?? loc.lat) + (rnd() - 0.5) * 0.024).toFixed(6), lng = +((p?.loc.lng ?? loc.lng) + (rnd() - 0.5) * 0.024).toFixed(6);
  const typeName: Record<string, string> = { apartment: "Apartment", house: "Independent House", villa: "Villa", plot: "Residential Plot", office: "Office Space", shop: "Shop", warehouse: "Warehouse", pg: "PG" };
  const title = tx === "pg"
    ? `${tenants[0] === "girls" ? "Girls" : "Boys"} PG with ${meals ? "meals" : "kitchen"} in ${loc.name}`
    : `${bhk && !["plot", "office", "shop", "warehouse"].includes(type) ? `${bhk} BHK ` : ""}${typeName[type]} for ${tx === "sell" ? "Sale" : "Rent"} in ${p ? `${p.name}, ` : type === "apartment" ? `${society}, ` : ""}${loc.name}`;
  const status = opts.status ?? "live";
  const daysAgo = opts.daysAgo ?? int(0, 55);
  const created = iso(daysAgo + 1);
  const published = status === "pending" ? null : iso(daysAgo);
  const expires = status === "expired" ? iso(int(1, 20)) : future(60 - daysAgo);
  const verified = status === "live" && chance(opts.by === "builder" ? 0.5 : 0.24) ? 1 : 0;
  const featured = status === "live" && chance(0.08) ? 1 : 0;
  const premium = status === "live" && chance(0.07) ? 1 : 0;
  const views = status === "live" ? int(20, 1800) : int(0, 40);
  const desc = descFor({ tx, type, cat, area: carpet ?? plotA, facing, loc, bhk, bath, balc, furnishing, floor: floor ?? 1, society, tenants, deposit, maintenance, avail, cs, age, possession, negotiable, pgFor: tenants[0] === "girls" ? "girls'" : "boys'", sharing: (sharing ?? "").replace(",", " and "), meals });
  const autoFlags = JSON.stringify({ duplicate: false, phoneValid: true, imagesOk: true, priceOutlier: false });
  const id = Number(insL.run(opts.userId, opts.by, title, tx, cat, type, loc.cityId, loc.id, p?.id ?? null, `${type === "apartment" ? `${society}, ` : ""}${int(1, 40)}th Cross, ${loc.name}, ${loc.city}`, lat, lng, price, negotiable, maintenance, deposit, bhk, bath, balc, carpet, builtup, superA, plotA, floor, floorTotal, facing, age, furnishing, cs, possession, p?.status === "new_launch" ? 1 : 0, p?.rera ?? (tx === "sell" && cs === "under_construction" ? reraId(loc.state) : null), verified, tenants.join(",") || null, avail, sharing, meals, desc, status, status === "rejected" ? "Photos appear to be taken from another listing. Please upload original photos of the property." : null, featured, premium, premium ? 2 : featured ? 1 : 0, views, null, created, created, published, expires, autoFlags).lastInsertRowid);

  // Photos
  const kinds = type === "plot" ? ["plot", "plot"] : cat === "commercial" ? (type === "shop" ? ["shop", "office", "living"] : ["office", "office", "kitchen"]) : type === "pg" ? ["bed", "bed", "living", "kitchen"] : [type === "apartment" ? "tower" : type === "villa" ? "villa" : "house", "living", "bed", "kitchen", "living", "bed"];
  const nPhotos = chance(0.06) ? 0 : Math.min(kinds.length, int(3, kinds.length));
  for (let i = 0; i < nPhotos; i++) insM.run(id, "photo", `/api/art/${kinds[i]}/${id * 11 + i}`, i);
  if (bhk && type !== "pg") insM.run(id, "floorplan", `/api/art/floorplan/${id}`, 0);

  // Amenities
  const am = type === "pg" ? ["wifi", "meals", "housekeeping", "power_backup", "security", "cctv"].filter(() => chance(0.8)) : type === "apartment" ? AMENITY_ALL.filter(() => chance(0.6)) : ["parking", "power_backup", "security", "park"].filter(() => chance(0.55));
  am.forEach((a) => insA.run(id, a));

  // Stats for the last 30 days
  if (status === "live" || status === "sold" || status === "rented" || status === "expired") {
    for (let d = Math.min(29, daysAgo); d >= 0; d--) {
      const day = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      const imp = int(10, 140) * (premium ? 3 : featured ? 2 : 1);
      const v = Math.round(imp * (0.05 + rnd() * 0.12));
      insStat.run(id, day, imp, v, chance(0.25) ? int(1, 3) : 0, chance(0.2) ? 1 : 0);
    }
  }
  insMod.run(id, null, "submitted", null, created);
  insMod.run(id, null, "auto_check", "Passed: phone valid, no duplicate found, images ok", created);
  if (status !== "pending") insMod.run(id, adminId, status === "rejected" ? "rejected" : "approved", status === "rejected" ? "Photos appear to be taken from another listing" : null, published ?? created);
  (listingOwners[opts.userId] ??= []).push(id);
  listingCount++;
  if (!dupSource && tx === "sell" && type === "apartment") dupSource = { id, loc, price, bhk };
  return id;
}

// Builder inventory inside projects
for (const p of projects) {
  const n = int(3, 6);
  for (let i = 0; i < n; i++) makeListing({ userId: p.builderId, by: "builder", loc: p.loc, tx: "sell", type: "apartment", project: p });
}
// Agents
for (const a of agents) {
  const n = a.id === demoAgent ? 14 : int(6, 12);
  const cityLocs = LOCS.filter((l) => l.cityIdx === a.city);
  for (let i = 0; i < n; i++) makeListing({ userId: a.id, by: "agent", loc: pick(cityLocs), cat: chance(0.18) ? "commercial" : "residential" });
}
// Owners
for (const o of owners) {
  const n = o === demoOwner ? 0 : int(1, 3);
  const ci = int(0, CITIES.length - 1);
  const cityLocs = LOCS.filter((l) => l.cityIdx === ci);
  for (let i = 0; i < n; i++) makeListing({ userId: o, by: "owner", loc: pick(cityLocs), cat: chance(0.07) ? "commercial" : "residential" });
}
// Demo owner: one of each lifecycle state so the dashboard is meaningful
const blr = LOCS.filter((l) => l.cityIdx === 0);
const ownerLive1 = makeListing({ userId: demoOwner, by: "owner", loc: blr[2], tx: "rent", type: "apartment", daysAgo: 12 });
const ownerLive2 = makeListing({ userId: demoOwner, by: "owner", loc: blr[1], tx: "sell", type: "apartment", daysAgo: 25 });
makeListing({ userId: demoOwner, by: "owner", loc: blr[0], tx: "rent", type: "house", status: "pending", daysAgo: 0 });
makeListing({ userId: demoOwner, by: "owner", loc: blr[5], tx: "sell", type: "apartment", status: "expired", daysAgo: 70 });

// Moderation queue: pending submissions across cities, including a likely duplicate and a price outlier
for (let i = 0; i < 9; i++) {
  const loc = pick(LOCS);
  const id = makeListing({ userId: pick(owners.slice(1)), by: "owner", loc, status: "pending", daysAgo: 0 });
  if (i === 0) db.prepare("UPDATE listings SET auto_flags = ? WHERE id = ?").run(JSON.stringify({ duplicate: false, phoneValid: true, imagesOk: true, priceOutlier: true }), id);
}
if (dupSource) {
  const id = makeListing({ userId: pick(owners.slice(1)), by: "owner", loc: dupSource.loc, tx: "sell", type: "apartment", status: "pending", daysAgo: 0 });
  db.prepare("UPDATE listings SET auto_flags = ?, price = ?, bhk = ? WHERE id = ?").run(JSON.stringify({ duplicate: true, duplicateOf: dupSource.id, phoneValid: true, imagesOk: false, priceOutlier: false }), dupSource.price, dupSource.bhk, id);
}
// A few rejected / sold / rented for realism
for (let i = 0; i < 4; i++) makeListing({ userId: pick(owners.slice(1)), by: "owner", loc: pick(LOCS), status: pick(["rejected", "sold", "rented", "expired"]), daysAgo: int(10, 50) });

// ---------------------------------------------------------------- leads, shortlists, visits
const insLead = db.prepare("INSERT INTO leads (listing_id, project_id, seeker_id, poster_id, name, phone, email, message, channel, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
const MESSAGES = [
  "Hi, is this still available? I'd like to visit this weekend.",
  "Interested. What is the final price?",
  "Can you share more photos of the kitchen and bathrooms?",
  "Is the rent negotiable? We are a family of three.",
  "Please call me after 6 pm.",
  "Is parking included? Also, are pets allowed?",
  "Looking to buy within 2 months. Is the home loan approved by SBI?",
  "",
];
const liveIds = db.prepare("SELECT id, user_id, project_id FROM listings WHERE status = 'live'").all() as any[];
const seekerInfo = db.prepare("SELECT id, name, phone, email FROM users WHERE id = ?");
for (const l of liveIds) {
  const n = l.user_id === demoAgent || l.user_id === demoOwner ? int(3, 9) : chance(0.5) ? int(0, 4) : 0;
  for (let i = 0; i < n; i++) {
    const s = seekerInfo.get(pick(seekers)) as any;
    insLead.run(l.id, l.project_id, s.id, l.user_id, s.name, s.phone, s.email, pick(MESSAGES), pick(["contact", "contact", "phone_reveal", "callback", "visit"]), pick(["new", "new", "contacted", "contacted", "closed", "spam"]), iso(int(0, 25)));
  }
}
for (const p of projects) {
  for (let i = 0; i < (p.builderId === demoBuilder ? 12 : int(2, 8)); i++) {
    const s = seekerInfo.get(pick(seekers)) as any;
    insLead.run(null, p.id, s.id, p.builderId, s.name, s.phone, s.email, pick(["Please share the price list and floor plans.", "Interested in a 3 BHK on a higher floor.", "What are the payment plan options?", "Would like a site visit on Sunday.", ""]), pick(["enquiry", "enquiry", "brochure", "visit", "callback"]), pick(["new", "new", "contacted", "closed"]), iso(int(0, 30)));
  }
}
const insShort = db.prepare("INSERT OR IGNORE INTO shortlists (user_id, listing_id, created_at) VALUES (?,?,?)");
const insSeen = db.prepare("INSERT OR IGNORE INTO seen_listings (user_id, listing_id, seen_at) VALUES (?,?,?)");
const blrLive = db.prepare("SELECT l.id FROM listings l WHERE status='live' AND city_id = 1 LIMIT 40").all() as any[];
blrLive.slice(0, 5).forEach((l) => insShort.run(demoSeeker, l.id, iso(int(0, 10))));
blrLive.slice(3, 15).forEach((l) => insSeen.run(demoSeeker, l.id, iso(int(0, 10))));
for (const s of seekers.slice(1)) for (let i = 0; i < 3; i++) insShort.run(s, pick(liveIds).id, iso(int(0, 30)));
db.prepare("INSERT INTO visits (listing_id, seeker_id, scheduled_at, status) VALUES (?,?,?,?)").run(ownerLive1, demoSeeker, future(2).slice(0, 16), "requested");
db.prepare("INSERT INTO visits (listing_id, seeker_id, scheduled_at, status) VALUES (?,?,?,?)").run(ownerLive2, seekers[3], future(4).slice(0, 16), "confirmed");
db.prepare("INSERT INTO saved_searches (user_id, name, query, channels, frequency, created_at) VALUES (?,?,?,?,?,?)").run(demoSeeker, "2-3 BHK rent in HSR & Koramangala", "city=bengaluru&tx=rent&bhk=2,3&max=60000", "email,push", "daily", iso(5));
db.prepare("INSERT INTO saved_searches (user_id, name, query, channels, frequency, created_at) VALUES (?,?,?,?,?,?)").run(demoSeeker, "Ready flats under 1.2 Cr", "city=bengaluru&tx=sell&cs=ready&max=12000000", "email", "weekly", iso(9));

// Notifications for demo users
const insN = db.prepare("INSERT INTO notifications (user_id, kind, title, body, link, read, created_at) VALUES (?,?,?,?,?,?,?)");
insN.run(demoOwner, "lead", "New enquiry on your 2 BHK in HSR Layout", "Ishaan Mehta wants to schedule a visit.", "/dashboard/responses", 0, iso(0));
insN.run(demoOwner, "moderation", "Your listing is under review", "We usually review new listings within 24 hours.", "/dashboard/listings", 0, iso(0));
insN.run(demoOwner, "system", "Your listing expired", "Renew it in one click to make it live again.", "/dashboard/listings", 1, iso(3));
insN.run(demoSeeker, "alert", "6 new matches for “2-3 BHK rent in HSR & Koramangala”", "Fresh listings posted in the last 24 hours.", "/search?city=bengaluru&tx=rent&bhk=2,3&max=60000", 0, iso(0));
insN.run(demoSeeker, "visit", "Site visit requested", "The owner will confirm your slot shortly.", "/account/contacted", 1, iso(1));
insN.run(demoAgent, "lead", "3 new responses today", "Reply quickly; fast responders rank higher.", "/dashboard/responses", 0, iso(0));
insN.run(demoBuilder, "lead", "New project enquiry", "A buyer downloaded your brochure.", "/dashboard/leads", 0, iso(0));

// ---------------------------------------------------------------- plans, orders
const insPlan = db.prepare("INSERT INTO plans (code, name, audience, price_paise, duration_days, listing_limit, boost, features, sort) VALUES (?,?,?,?,?,?,?,?,?)");
const plans = [
  ["owner_free", "Free", "owner", 0, 60, 3, 0, ["3 active listings", "60-day visibility", "Responses by SMS and email"], 0],
  ["owner_plus", "Owner Plus", "owner", 99900, 45, 5, 1, ["5 active listings", "45-day boost in search", "Plus badge on cards", "Priority moderation", "Listing insights"], 1],
  ["owner_premium", "Owner Premium", "owner", 249900, 90, 10, 2, ["10 active listings", "Top-of-search placement", "Premium badge", "Free physical verification", "WhatsApp alerts for every enquiry"], 2],
  ["agent_starter", "Agent Starter", "agent", 499900, 30, 25, 1, ["25 active listings", "Agent profile page", "Lead inbox with CSV export", "Ranked above free listings"], 3],
  ["agent_pro", "Agent Pro", "agent", 1299900, 30, 75, 2, ["75 active listings", "Top-of-search placement", "Locality spotlight", "Verified agent badge", "Dedicated account manager"], 4],
  ["builder_featured", "Featured Project", "builder", 4999900, 30, 50, 2, ["Featured project slot on city home page", "Sponsored placement in search", "Lead dashboard + CRM webhook"], 5],
  ["builder_max", "Builder Max", "builder", 14999900, 90, 200, 3, ["Everything in Featured Project", "Home page banner (2 weeks)", "Project microsite", "Email campaign to matched buyers"], 6],
] as const;
const planIds: Record<string, number> = {};
plans.forEach((p) => { planIds[p[0]] = Number(insPlan.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], JSON.stringify(p[7]), p[8]).lastInsertRowid); });
db.prepare("INSERT INTO coupons (code, percent_off, max_uses, expires_at) VALUES (?,?,?,?)").run("WELCOME20", 20, 1000, future(120));
db.prepare("INSERT INTO coupons (code, percent_off, max_uses, expires_at) VALUES (?,?,?,?)").run("BUILDER10", 10, 50, future(60));

const insOrder = db.prepare("INSERT INTO orders (user_id, plan_id, amount_paise, gst_paise, total_paise, status, gateway_ref, created_at, paid_at) VALUES (?,?,?,?,?,?,?,?,?)");
const insInv = db.prepare("INSERT INTO invoices (order_id, number, billing_name, billing_gstin, billing_state, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
const insSub = db.prepare("INSERT INTO subscriptions (user_id, plan_id, order_id, starts_at, ends_at, status) VALUES (?,?,?,?,?,?)");
let invSeq = 1;
function seedOrder(userId: number, code: string, daysAgo: number, billingName: string, state: string, gstin: string | null) {
  const p = plans.find((x) => x[0] === code)!;
  const amount = p[3] as number, gst = Math.round(amount * 0.18), total = amount + gst;
  const when = iso(daysAgo);
  const oid = Number(insOrder.run(userId, planIds[code], amount, gst, total, "paid", `pay_test_${Math.random().toString(36).slice(2, 12)}`, when, when).lastInsertRowid);
  const intra = state === "Karnataka";
  insInv.run(oid, `10C/2026-27/${String(invSeq++).padStart(5, "0")}`, billingName, gstin, state, amount, intra ? gst / 2 : 0, intra ? gst / 2 : 0, intra ? 0 : gst, total, when);
  insSub.run(userId, planIds[code], oid, when, new Date(new Date(when).getTime() + (p[4] as number) * 86400000).toISOString(), "active");
}
seedOrder(demoAgent, "agent_pro", 8, "Shetty Realty", "Karnataka", "29ABCDE1234F1Z5");
seedOrder(demoBuilder, "builder_featured", 12, "Banyan & Brick Developers", "Karnataka", null);
for (const a of agents.slice(1, 9)) seedOrder(a.id, pick(["agent_starter", "agent_pro"]), int(1, 28), "Agency", pick(["Karnataka", "Maharashtra", "Telangana"]), null);
for (const o of owners.slice(1, 15)) seedOrder(o, pick(["owner_plus", "owner_premium"]), int(1, 60), "Owner", pick(["Karnataka", "Maharashtra", "Tamil Nadu"]), null);
for (const b of builders.slice(1, 6)) seedOrder(b.id, pick(["builder_featured", "builder_max"]), int(1, 80), b.name, pick(["Karnataka", "Haryana", "Telangana"]), null);

// ---------------------------------------------------------------- reports (fraud queue)
const insRep = db.prepare("INSERT INTO reports (listing_id, reported_user_id, reporter_id, reason, details, status, created_at) VALUES (?,?,?,?,?,?,?)");
for (let i = 0; i < 7; i++) {
  const l = pick(liveIds);
  insRep.run(l.id, l.user_id, pick(seekers), pick(["fake", "wrong_info", "sold_out", "broker_as_owner", "fraud", "duplicate"]), pick(["Owner asked for a token advance before the visit.", "The flat was rented out 2 weeks ago.", "Photos do not match the actual property.", "Listed as owner but he asked for one month brokerage.", "Price shown is much lower than what was quoted on call.", ""]), i < 5 ? "open" : pick(["actioned", "dismissed"]), iso(int(0, 6)));
}

// ---------------------------------------------------------------- banners
db.prepare("INSERT INTO banners (title, subtitle, link, placement, project_id, starts_at, ends_at) VALUES (?,?,?,?,?,?,?)").run(
  `${projects[0].name}`, `${projects[0].units.map((u) => `${u.bhk}`).join(", ")} BHK homes in ${projects[0].loc.name}. RERA registered.`, `/projects/${slug(projects[0].name)}`, "home_top", projects[0].id, iso(5), future(20)
);
db.prepare("INSERT INTO banners (title, subtitle, link, placement, project_id, starts_at, ends_at) VALUES (?,?,?,?,?,?,?)").run(
  `${projects[2].name}`, `Pre-launch pricing in ${projects[2].loc.name}`, `/projects/${slug(projects[2].name)}`, "search_inline", projects[2].id, iso(2), future(25)
);

// ---------------------------------------------------------------- reviews
const insRev = db.prepare("INSERT INTO reviews (locality_id, project_id, agent_id, user_id, rating, body, created_at) VALUES (?,?,?,?,?,?,?)");
const REVIEW_TEXT = [
  "Great neighbourhood for families. Parks are well maintained and there is a good mix of schools nearby.",
  "Traffic during office hours is a pain, but weekends are calm. Plenty of restaurants.",
  "Water supply has been reliable in our society. Power cuts are rare and short.",
  "Prices have gone up a lot in the last two years. Rentals are still reasonable for bachelors.",
  "Safe area, lots of people walk in the evening. Metro will make a big difference once ready.",
  "Too many construction sites around right now, dusty. Should improve in a year.",
];
for (const l of LOCS) for (let i = 0; i < int(1, 4); i++) insRev.run(l.id, null, null, pick(seekers), int(3, 5), pick(REVIEW_TEXT), iso(int(1, 200)));
for (const a of agents) for (let i = 0; i < int(2, 5); i++) insRev.run(null, null, a.id, pick(seekers), int(3, 5), pick(["Very responsive and honest. Helped us close in 3 weeks.", "Showed us exactly what we asked for, no time wasted.", "Good knowledge of the area. Paperwork was smooth.", "Took a while to respond, but the deal went fine."]), iso(int(1, 300)));

// Keep agent ratings consistent with the reviews that exist.
db.prepare(`UPDATE profiles SET rating = (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.agent_id = profiles.user_id), rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.agent_id = profiles.user_id) WHERE user_id IN (SELECT agent_id FROM reviews WHERE agent_id IS NOT NULL)`).run();

// ---------------------------------------------------------------- articles & static pages
const insArt = db.prepare("INSERT INTO articles (slug, title, category, author_name, excerpt, body, cover_url, city_id, seo_title, seo_description, status, published_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
const ARTICLES: Array<[string, string, string, string, string]> = [
  ["How to check a project's RERA registration before you pay a token", "legal", "Leela Varma",
    "A five-minute check on your state's RERA portal can save you years of trouble. Here is exactly what to look for.",
    `## Why RERA matters\nThe Real Estate (Regulation and Development) Act, 2016 requires every residential project above 500 sq m or 8 units to be registered with the state authority before it is advertised or sold. Registration means the builder has disclosed approvals, timelines and finances, and that 70% of buyer money must sit in a separate escrow account.\n\n## Step 1: Find the registration number\nIt must be printed on every advertisement, brochure and listing. On 10cent it appears on the project page and on every listing inside the project, linked to the state portal.\n\n## Step 2: Search it on the state portal\nOpen your state's RERA website, choose "Registered projects" and search by number or project name. Check that the promoter name matches the company you are dealing with.\n\n## Step 3: Read the disclosures\n- Approved plan and number of floors\n- Declared completion date (compare with what sales tells you)\n- Quarterly progress updates\n- Litigation, if any\n\n## Red flags\n- No RERA number on a project that is clearly large enough to need one\n- A different promoter name on the portal\n- Completion date on the portal much later than the sales pitch\n\nIf anything looks wrong, use **Report** on the listing and our team will review it within 24 hours.`],
  ["Stamp duty in 2026: what buyers in Karnataka, Maharashtra and Telangana pay", "tax", "Rohan Iyer",
    "Stamp duty and registration can add 6–8% to your purchase price. A state-by-state breakdown and how to estimate it.",
    `## The basics\nStamp duty is a state tax on the transfer of property. Registration fee is a separate charge, usually 1%. Both are paid at the sub-registrar office when the sale deed is registered.\n\n## Rates at a glance\n- **Karnataka:** 5% stamp duty for properties above ₹45 lakh, plus 1% registration and small cess\n- **Maharashtra:** 6% in Mumbai (including metro cess), 7% in Pune and most urban areas, 1% registration capped at ₹30,000; women buyers get a 1% concession\n- **Telangana:** 5.5% stamp duty plus 0.5% registration and 1.5% transfer duty, about 7.5% in total\n- **Tamil Nadu:** 7% stamp duty plus 2% registration\n- **Haryana:** 7% for men, 5% for women in urban areas\n\nRates change often; always confirm with your state's IGR website before you budget.\n\n## Use the calculator\nOur [stamp duty calculator](/tools/stamp-duty) applies these rules for you.`],
  ["Renting in Bengaluru: a checklist before you sign the agreement", "renting-guide", "Ananya Rao",
    "Deposits, lock-in periods, maintenance and the clauses that cause the most disputes.",
    `## Before you pay anything\n- Visit the flat in person. Never transfer a token for a place you have not seen.\n- Ask the owner for an ID and a recent electricity bill in their name.\n- Check whether the listing is posted by an owner or an agent; it is shown on every 10cent card.\n\n## The deposit\nBengaluru deposits have come down from 10 months to 3–6 months in most areas. Get the deposit amount, refund timeline and permitted deductions written into the agreement.\n\n## Clauses to read twice\n- **Lock-in period:** usually 6–11 months; breaking it may cost one month's rent\n- **Rent escalation:** 5–10% a year is normal\n- **Painting charges:** often deducted at move-out\n- **Maintenance:** who pays society maintenance and for what\n\n## Register it\nAn 11-month agreement on stamp paper is common. Longer agreements must be registered.`],
  ["Carpet area vs built-up vs super built-up: what you are actually paying for", "buying-guide", "Rohan Iyer",
    "Builders quote super built-up; RERA requires carpet area. Learn the difference and the loading you should expect.",
    `## Three numbers, one flat\n- **Carpet area** is the usable floor inside your walls. RERA requires builders to sell on carpet area.\n- **Built-up area** adds the thickness of walls and your balcony, usually 10–15% more than carpet.\n- **Super built-up area** adds your share of lobbies, lifts, stairs and the clubhouse.\n\n## Loading\nLoading is the gap between carpet and super built-up. 25–35% is typical; more than 40% means you are paying for a lot of common space.\n\n## How to compare two listings\nAlways compare price per sq ft of **carpet** area. Our listing pages show both carpet and super built-up where available.`],
  ["Home loan EMIs after the latest repo rate decision", "news", "Karthik Menon",
    "What the central bank's decision means for floating-rate borrowers, and when a prepayment makes sense.",
    `## What changed\nThe policy repo rate was left unchanged this month. Most banks link home loans to the repo rate through an external benchmark, so EMIs stay flat for now.\n\n## Should you prepay?\nIf you have surplus cash and your loan rate is higher than what you would earn in a fixed deposit after tax, prepaying principal early in the tenure saves the most interest.\n\nTry different prepayment amounts in our [EMI calculator](/tools/emi): the amortisation table shows the months and interest you save.\n\n## Switching lenders\nA rate difference of 0.5% or more on a large outstanding balance can justify a balance transfer, even after processing fees.`],
  ["Whitefield vs Sarjapur Road: where should IT professionals buy?", "city-guide", "Ananya Rao",
    "Two of Bengaluru's busiest corridors compared on commute, prices, rental yield and upcoming infrastructure.",
    `## Commute\nWhitefield now has metro connectivity to the city centre. Sarjapur Road depends on road transport, and the Outer Ring Road junction remains a bottleneck.\n\n## Prices\nWhitefield averages around ₹8,000–8,500 per sq ft for apartments; Sarjapur Road is slightly cheaper at ₹7,500–8,000, with more new launches.\n\n## Rental yield\nBoth corridors see 3–3.5% gross yields thanks to steady demand from tech parks.\n\n## Verdict\nIf you value a predictable commute today, Whitefield. If you are buying for appreciation and can wait for infrastructure, Sarjapur Road.\n\nCompare live prices on the [price trends](/tools/price-trends) page.`],
  ["Documents an NRI needs to buy property in India", "legal", "Leela Varma",
    "PAN, power of attorney, NRE/NRO accounts and repatriation rules, explained plainly.",
    `## Who can buy\nNon-resident Indians and OCI card holders can buy residential and commercial property in India. Agricultural land, plantations and farmhouses are not allowed.\n\n## Documents\n- Passport and OCI card (if applicable)\n- PAN card\n- Overseas address proof\n- Power of attorney if someone in India will sign on your behalf; it must be attested at the Indian embassy\n\n## Payments\nPay from an NRE, NRO or FCNR account, or by inward remittance. Cash and traveller's cheques are not permitted.\n\n## Selling later\nRepatriation of sale proceeds is allowed for up to two residential properties, subject to tax and documentation.`],
  ["Pune's Hinjewadi metro: what it means for property prices", "news", "Karthik Menon",
    "With the metro line nearing completion, prices around the IT park have started to move.",
    `## Status\nThe elevated line connecting Hinjewadi to Shivajinagar is in its final phase of work, with stations at the IT park phases and Wakad.\n\n## Prices\nAverage apartment prices in Hinjewadi have risen around 8% over the past year, in line with Wakad and Baner. Rentals near Phase 1 and 2 have seen the sharpest increase.\n\n## Buying advice\nProperties within a 10-minute walk of a station usually see the most benefit. Check the [locality page](/localities/pune/hinjewadi) for trends.`],
  ["Ready-to-move vs under-construction: the real cost comparison", "buying-guide", "Rohan Iyer",
    "GST, rent while you wait, pre-EMI interest and delivery risk. A worked example.",
    `## GST\nUnder-construction homes attract 5% GST (1% for affordable housing). Ready homes with an occupancy certificate attract none.\n\n## The waiting cost\nIf you are renting while the flat is built, add your rent for the remaining construction period. Add pre-EMI interest if your loan is disbursed in stages.\n\n## The discount\nUnder-construction prices are typically 10–20% lower than comparable ready homes. Whether that offsets GST, rent and risk depends on the builder's track record.\n\n## Check before you decide\n- Builder's past projects and their actual delivery dates (see the builder profile)\n- RERA quarterly progress updates\n- Construction progress per tower, shown on our project pages`],
  ["Chennai OMR rental market update", "city-guide", "Ananya Rao",
    "Sholinganallur, Perungudi and Navalur see strong demand as offices return to five days a week.",
    `## Demand\nWith more companies asking employees back to office, OMR has seen the fastest rental absorption in Chennai this year.\n\n## Rents\nA 2 BHK in Sholinganallur now rents for ₹22,000–28,000 a month, up from ₹19,000–24,000 a year ago.\n\n## Tips for tenants\nShortlist early; good flats are taken within a week of listing. Use saved searches with instant alerts so you see new listings first.`],
];
ARTICLES.forEach(([title, cat, author, excerpt, body], i) => {
  const s = slug(title);
  const when = iso(i * 3 + 1);
  insArt.run(s, title, cat, author, excerpt, body, `/api/art/${pick(["tower", "living", "house", "villa", "office"])}/${500 + i}`, null, title, excerpt, "published", when, when, when);
});
insArt.run("draft-q4-market-report", "Q4 market report (draft)", "news", "Leela Varma", "Quarterly data across our launch cities.", "## Draft\nNumbers to be filled in.", null, null, null, null, "draft", null, iso(0), iso(0));

const insPage = db.prepare("INSERT INTO static_pages (slug, title, body) VALUES (?,?,?)");
insPage.run("about", "About 10cent", "## Built on trust\n10cent is a property marketplace for India. Seekers use it for free. Owners can post a limited number of listings free, and agents and builders pay for more reach.\n\n## What we do differently\n- Every listing passes automated checks and a human review before it goes live\n- Verified badges are earned through a physical visit by our field team\n- RERA numbers are shown and linked to the state portal\n- Phone numbers are shown only to signed-in users, with rate limits that stop scraping");
insPage.run("terms", "Terms of use", "## Using 10cent\nBy using 10cent you agree to post accurate information, not to scrape data, and not to use contact details for spam.\n\n## Listings\nWe may edit, reject or remove listings that break our posting policy.\n\n## Payments\nPaid plans are non-refundable once a listing has been boosted, except where required by law.");
insPage.run("privacy", "Privacy policy", "## What we collect\nYour phone number, email and the searches and listings you interact with.\n\n## Why\nTo show relevant listings, pass your enquiries to the poster you choose to contact, and keep the platform safe.\n\n## Your rights under the DPDP Act, 2023\nYou can download or delete your data from Account → Profile. Deletion removes your personal data within 30 days, except records we must keep by law (for example GST invoices).");
insPage.run("posting-policy", "Posting policy", "## Listings must be\n- For a real, available property\n- Posted by the owner, or an agent or builder authorised by the owner\n- Priced honestly; no fake low prices to attract calls\n- Illustrated with original photos\n\n## Not allowed\n- Asking for token money before a visit\n- Duplicate listings of the same property\n- Contact details inside photos or description");

console.log(`Seeded: ${CITIES.length} cities, ${LOCS.length} localities, ${projects.length} projects, ${listingCount} listings.`);
console.log("Demo logins (phone; OTP is shown on screen in dev mode):");
console.log("  Super admin  9000000001 | Moderator 9000000002 | Support 9000000003 | Sales 9000000004 | Content 9000000005");
console.log("  Owner        9876543210 | Agent 9876543211 | Builder 9876543212 | Seeker 9876543213");
db.close();
