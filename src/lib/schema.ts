// Database schema (PRD §6.3). Plain module so scripts can import it outside Next.js.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'seeker',          -- seeker | owner | agent | builder | admin
  admin_role TEXT,                               -- super | moderator | support | sales | content
  kyc_status TEXT NOT NULL DEFAULT 'none',       -- none | pending | verified | rejected
  blocked INTEGER NOT NULL DEFAULT 0,
  block_reason TEXT,
  is_nri INTEGER NOT NULL DEFAULT 0,
  preferred_cities TEXT,                         -- comma separated city slugs
  budget_min INTEGER,
  budget_max INTEGER,
  free_listing_limit INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT,
  rera_number TEXT,
  experience_years INTEGER,
  established_year INTEGER,
  about TEXT,
  city_id INTEGER REFERENCES cities(id),
  website TEXT,
  gstin TEXT,
  logo_url TEXT,
  rating REAL,
  rating_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target TEXT NOT NULL,                          -- phone or email
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_otps_target ON otps(target, created_at);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  is_launch INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS localities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL REFERENCES cities(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  rating REAL,
  connectivity REAL,
  safety REAL,
  lifestyle REAL,
  description TEXT,
  landmarks TEXT,                                -- JSON array of {name, kind, lat, lng}
  trending INTEGER NOT NULL DEFAULT 0,
  UNIQUE(city_id, slug)
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  posted_by_type TEXT NOT NULL,                  -- owner | agent | builder
  title TEXT NOT NULL,
  transaction_type TEXT NOT NULL,                -- sell | rent | pg
  category TEXT NOT NULL DEFAULT 'residential',  -- residential | commercial
  property_type TEXT NOT NULL,                   -- apartment | house | villa | plot | office | shop | warehouse | pg
  city_id INTEGER NOT NULL REFERENCES cities(id),
  locality_id INTEGER REFERENCES localities(id),
  project_id INTEGER REFERENCES projects(id),
  address TEXT,
  lat REAL,
  lng REAL,
  price INTEGER NOT NULL,                        -- sale price, or monthly rent
  price_negotiable INTEGER NOT NULL DEFAULT 0,
  maintenance INTEGER,
  deposit INTEGER,
  bhk INTEGER,
  bathrooms INTEGER,
  balconies INTEGER,
  carpet_area INTEGER,                           -- sq ft
  builtup_area INTEGER,
  super_area INTEGER,
  plot_area INTEGER,
  floor INTEGER,
  total_floors INTEGER,
  facing TEXT,
  age_years INTEGER,
  furnishing TEXT,                               -- unfurnished | semi | furnished
  construction_status TEXT,                      -- ready | under_construction
  possession_date TEXT,
  new_launch INTEGER NOT NULL DEFAULT 0,
  rera_id TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  verification_requested_at TEXT,
  tenant_types TEXT,                             -- comma list: family,bachelor,company,girls,boys
  available_from TEXT,
  pg_sharing TEXT,                               -- single,double,triple
  pg_meals INTEGER,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',        -- draft | pending | live | rejected | expired | paused | sold | rented | removed
  reject_reason TEXT,
  auto_flags TEXT,                               -- JSON of automated check results
  featured INTEGER NOT NULL DEFAULT 0,
  premium INTEGER NOT NULL DEFAULT 0,
  boost INTEGER NOT NULL DEFAULT 0,              -- ranking boost from paid plan
  views INTEGER NOT NULL DEFAULT 0,
  dup_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  published_at TEXT,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_listings_search ON listings(status, city_id, transaction_type, price);
CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_locality ON listings(locality_id);

CREATE TABLE IF NOT EXISTS listing_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'photo',            -- photo | video | floorplan | tour
  url TEXT NOT NULL,
  caption TEXT,
  sha256 TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_media_listing ON listing_media(listing_id, sort);
CREATE INDEX IF NOT EXISTS idx_media_hash ON listing_media(sha256);

CREATE TABLE IF NOT EXISTS listing_amenities (
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  amenity TEXT NOT NULL,
  PRIMARY KEY (listing_id, amenity)
);

CREATE TABLE IF NOT EXISTS listing_stats (
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  day TEXT NOT NULL,                             -- YYYY-MM-DD
  impressions INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  contacts INTEGER NOT NULL DEFAULT 0,
  shortlists INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (listing_id, day)
);

CREATE TABLE IF NOT EXISTS moderation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id),         -- NULL = automated
  action TEXT NOT NULL,                          -- submitted | auto_check | approved | rejected | edited | takedown | expired | renewed
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  builder_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  city_id INTEGER NOT NULL REFERENCES cities(id),
  locality_id INTEGER REFERENCES localities(id),
  address TEXT,
  lat REAL,
  lng REAL,
  rera_id TEXT,
  rera_state TEXT,
  status TEXT NOT NULL,                          -- new_launch | under_construction | ready
  launch_date TEXT,
  possession_date TEXT,
  total_units INTEGER,
  land_area_acres REAL,
  description TEXT,
  price_min INTEGER,
  price_max INTEGER,
  amenities TEXT,                                -- JSON array
  location_advantages TEXT,                      -- JSON array of {name, distance}
  featured INTEGER NOT NULL DEFAULT 0,
  sponsored INTEGER NOT NULL DEFAULT 0,
  approved INTEGER NOT NULL DEFAULT 1,
  brochure_url TEXT,
  master_plan_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS project_towers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  floors INTEGER,
  units INTEGER,
  completion_pct INTEGER
);

CREATE TABLE IF NOT EXISTS project_unit_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  bhk INTEGER,
  carpet_area INTEGER,
  super_area INTEGER,
  price INTEGER,
  floor_plan_url TEXT,
  available_units INTEGER
);

CREATE TABLE IF NOT EXISTS project_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'photo',
  url TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  seeker_id INTEGER REFERENCES users(id),
  poster_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT,
  phone TEXT,
  email TEXT,
  message TEXT,
  channel TEXT NOT NULL,                         -- contact | phone_reveal | callback | visit | enquiry | brochure
  status TEXT NOT NULL DEFAULT 'new',            -- new | contacted | spam | closed
  consent INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_poster ON leads(poster_id, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_seeker ON leads(seeker_id, created_at);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  seeker_id INTEGER REFERENCES users(id),
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',      -- requested | confirmed | done | cancelled
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS shortlists (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS seen_listings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,                           -- URL query string of /search
  channels TEXT NOT NULL DEFAULT 'email',        -- comma list: email,sms,push,whatsapp
  frequency TEXT NOT NULL DEFAULT 'daily',       -- instant | daily | weekly
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                            -- lead | alert | moderation | billing | system | visit
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read, created_at);

CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email INTEGER NOT NULL DEFAULT 1,
  sms INTEGER NOT NULL DEFAULT 1,
  whatsapp INTEGER NOT NULL DEFAULT 0,
  push INTEGER NOT NULL DEFAULT 1
);

-- Outbox of messages that would be sent by SMS / email / WhatsApp / push providers.
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,                         -- sms | email | whatsapp | push
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',         -- queued | sent | failed
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  city_id INTEGER NOT NULL REFERENCES cities(id),
  locality_ids TEXT,
  property_type TEXT,
  bhk INTEGER,
  budget_min INTEGER,
  budget_max INTEGER,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  audience TEXT NOT NULL,                        -- owner | agent | builder
  price_paise INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  listing_limit INTEGER NOT NULL,
  boost INTEGER NOT NULL DEFAULT 0,
  features TEXT,                                 -- JSON array of strings
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  order_id INTEGER REFERENCES orders(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'          -- active | expired | cancelled
);

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  percent_off INTEGER NOT NULL,
  max_uses INTEGER,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  coupon_id INTEGER REFERENCES coupons(id),
  amount_paise INTEGER NOT NULL,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  gst_paise INTEGER NOT NULL,
  total_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',        -- created | paid | failed | refunded
  gateway TEXT NOT NULL DEFAULT 'test',
  gateway_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at TEXT,
  refunded_at TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id),
  number TEXT UNIQUE NOT NULL,
  billing_name TEXT,
  billing_gstin TEXT,
  billing_state TEXT,
  taxable_paise INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0,
  sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  reported_user_id INTEGER REFERENCES users(id),
  reporter_id INTEGER REFERENCES users(id),
  reason TEXT NOT NULL,                          -- fake | wrong_info | sold_out | broker_as_owner | fraud | duplicate | other
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',           -- open | actioned | dismissed
  admin_note TEXT,
  resolved_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,                        -- news | buying-guide | renting-guide | legal | tax | city-guide
  author_name TEXT NOT NULL,
  excerpt TEXT,
  body TEXT NOT NULL,                            -- simple markdown (## headings, paragraphs, - lists)
  cover_url TEXT,
  city_id INTEGER REFERENCES cities(id),
  seo_title TEXT,
  seo_description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',          -- draft | published
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS static_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS price_trends (
  locality_id INTEGER NOT NULL REFERENCES localities(id) ON DELETE CASCADE,
  month TEXT NOT NULL,                           -- YYYY-MM
  avg_price_sqft INTEGER NOT NULL,
  avg_rent_2bhk INTEGER NOT NULL,
  PRIMARY KEY (locality_id, month)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  locality_id INTEGER REFERENCES localities(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'published',      -- pending | published | removed
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT,
  link TEXT,
  placement TEXT NOT NULL,                       -- home_top | search_inline | project_sidebar
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  starts_at TEXT,
  ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_status TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;
