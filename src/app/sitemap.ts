import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const SITE = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const revalidate = 3600;

const TOOLS = ["emi", "eligibility", "area-converter", "price-trends", "valuation", "stamp-duty", "rental-yield", "rent-receipt"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const u = (path: string, lastModified: string | Date = now, priority = 0.5, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly") => ({
    url: `${SITE}${path}`, lastModified: new Date(lastModified), priority, changeFrequency,
  });
  const out: MetadataRoute.Sitemap = [
    u("/", now, 1, "daily"),
    u("/search", now, 0.8, "daily"),
    u("/projects", now, 0.8, "daily"),
    u("/news", now, 0.6, "daily"),
    u("/tools", now, 0.5, "monthly"),
    ...TOOLS.map((t) => u(`/tools/${t}`, now, 0.5, "monthly")),
    u("/services", now, 0.4, "monthly"),
    u("/services/home-loan", now, 0.5, "monthly"),
    u("/requirement", now, 0.4, "monthly"),
  ];
  const statics = db.prepare("SELECT slug, updated_at FROM static_pages").all() as Array<{ slug: string; updated_at: string }>;
  out.push(...statics.map((s) => u(`/${s.slug}`, s.updated_at, 0.3, "yearly")));

  const cities = db.prepare("SELECT slug FROM cities ORDER BY sort").all() as Array<{ slug: string }>;
  for (const c of cities) {
    out.push(u(`/property-in-${c.slug}`, now, 0.9, "daily"));
    out.push(u(`/localities/${c.slug}`, now, 0.6, "weekly"));
  }
  const locs = db.prepare("SELECT lo.slug, c.slug city FROM localities lo JOIN cities c ON c.id = lo.city_id").all() as Array<{ slug: string; city: string }>;
  out.push(...locs.map((l) => u(`/localities/${l.city}/${l.slug}`, now, 0.7, "weekly")));

  const projects = db.prepare("SELECT slug, created_at FROM projects WHERE approved = 1").all() as Array<{ slug: string; created_at: string }>;
  out.push(...projects.map((p) => u(`/projects/${p.slug}`, p.created_at, 0.7, "weekly")));

  const builders = db.prepare("SELECT DISTINCT builder_id id FROM projects WHERE approved = 1").all() as Array<{ id: number }>;
  out.push(...builders.map((b) => u(`/builders/${b.id}`, now, 0.4, "monthly")));

  const agents = db.prepare("SELECT id FROM users WHERE role = 'agent' AND deleted_at IS NULL AND blocked = 0").all() as Array<{ id: number }>;
  out.push(...agents.map((a) => u(`/agents/${a.id}`, now, 0.4, "weekly")));

  const listings = db.prepare("SELECT id, updated_at FROM listings WHERE status = 'live' ORDER BY id").all() as Array<{ id: number; updated_at: string }>;
  out.push(...listings.map((l) => u(`/property/${l.id}`, l.updated_at, 0.6, "weekly")));

  const articles = db.prepare("SELECT slug, updated_at FROM articles WHERE status = 'published'").all() as Array<{ slug: string; updated_at: string }>;
  out.push(...articles.map((a) => u(`/news/${a.slug}`, a.updated_at, 0.5, "monthly")));
  return out;
}
