"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, nowIso } from "@/lib/db";
import { notify } from "@/lib/notify";
import { saveUpload } from "@/lib/uploads";
import { slugify } from "@/lib/format";
import { ARTICLE_CATEGORIES, STATES } from "@/lib/constants";
import { staff, auditAs, done, fail, NOT_ALLOWED, str, int, bool, zodErrors, type ActionState } from "./guard";

/* ---------------------------------------------------------------- AD6 projects */

export async function toggleProject(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("projects");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const field = str(fd, "field");
  if (!["approved", "featured", "sponsored"].includes(field)) return fail("Unknown field.");
  const p = db.prepare(`SELECT name, builder_id, ${field} v FROM projects WHERE id = ?`).get(id) as { name: string; builder_id: number; v: number } | undefined;
  if (!p) return fail("Project not found.");
  const next = p.v ? 0 : 1;
  db.prepare(`UPDATE projects SET ${field} = ? WHERE id = ?`).run(next, id);
  await auditAs(me, `project.${field}.${next ? "on" : "off"}`, "project", id);
  if (field === "approved") {
    notify(p.builder_id, next
      ? { kind: "moderation", title: `${p.name} is approved`, body: "Your project page is now public.", link: "/dashboard" }
      : { kind: "moderation", title: `${p.name} was unpublished`, body: "Our team has hidden this project pending review. Contact your account manager.", link: "/dashboard" }, ["email"]);
  }
  return done(`${p.name}: ${field} ${next ? "on" : "off"}.`);
}

/* ---------------------------------------------------------------- AD6 banners */

const bannerSchema = z.object({
  title: z.string().trim().min(3, "Required").max(80),
  subtitle: z.string().trim().max(160).nullable(),
  link: z.string().trim().regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/, "Use a site path like /projects/x or an https:// URL"),
  placement: z.enum(["home_top", "search_inline", "project_sidebar"], { message: "Pick a placement" }),
  project_id: z.number().int().positive().nullable(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
});

const dt = (s: string) => (s ? new Date(s + (s.length === 10 ? "T00:00:00+05:30" : ":00+05:30")).toISOString() : null);

export async function saveBanner(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("banners");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id")) || null;
  const parsed = bannerSchema.safeParse({
    title: str(fd, "title"), subtitle: str(fd, "subtitle") || null, link: str(fd, "link"), placement: str(fd, "placement"),
    project_id: int(fd, "project_id"), starts_at: dt(str(fd, "starts_at")), ends_at: dt(str(fd, "ends_at")),
  });
  if (!parsed.success) return fail("Fix the highlighted fields.", zodErrors(parsed.error.issues));
  const v = parsed.data;
  if (v.starts_at && v.ends_at && v.ends_at <= v.starts_at) return fail("End must be after start.", { ends_at: "Before start" });
  if (v.project_id && !db.prepare("SELECT 1 FROM projects WHERE id = ?").get(v.project_id)) return fail("Unknown project.", { project_id: "Not found" });
  const active = bool(fd, "active");
  if (id) {
    db.prepare("UPDATE banners SET title=?, subtitle=?, link=?, placement=?, project_id=?, starts_at=?, ends_at=?, active=? WHERE id = ?")
      .run(v.title, v.subtitle, v.link, v.placement, v.project_id, v.starts_at, v.ends_at, active, id);
    await auditAs(me, "banner.update", "banner", id, { ...v, active });
    return done("Banner saved.");
  }
  const nid = Number(db.prepare("INSERT INTO banners (title, subtitle, link, placement, project_id, starts_at, ends_at, active) VALUES (?,?,?,?,?,?,?,?)")
    .run(v.title, v.subtitle, v.link, v.placement, v.project_id, v.starts_at, v.ends_at, active).lastInsertRowid);
  await auditAs(me, "banner.create", "banner", nid, v);
  return done("Banner scheduled.");
}

export async function deleteBanner(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("banners");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const b = db.prepare("SELECT title, impressions, clicks FROM banners WHERE id = ?").get(id);
  if (!b) return fail("Banner not found.");
  db.prepare("DELETE FROM banners WHERE id = ?").run(id);
  await auditAs(me, "banner.delete", "banner", id, b);
  return done("Banner deleted.");
}

/* ---------------------------------------------------------------- AD7 articles */

const articleSchema = z.object({
  title: z.string().trim().min(8, "At least 8 characters").max(140),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens").max(120),
  category: z.enum(ARTICLE_CATEGORIES.map((c) => c.value) as [string, ...string[]], { message: "Pick a category" }),
  author_name: z.string().trim().min(2, "Required").max(60),
  excerpt: z.string().trim().max(300, "Keep under 300 characters").nullable(),
  body: z.string().trim().min(80, "Write at least a few paragraphs (80+ characters)").max(60000),
  city_id: z.number().int().positive().nullable(),
  seo_title: z.string().trim().max(70, "Search engines cut titles after ~60–70 characters").nullable(),
  seo_description: z.string().trim().max(170, "Keep under 170 characters").nullable(),
});

export async function saveArticle(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("cms");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id")) || null;
  const intent = str(fd, "intent"); // save | publish | unpublish
  const parsed = articleSchema.safeParse({
    title: str(fd, "title"),
    slug: slugify(str(fd, "slug") || str(fd, "title")),
    category: str(fd, "category"),
    author_name: str(fd, "author_name"),
    excerpt: str(fd, "excerpt") || null,
    body: String(fd.get("body") ?? "").replace(/\r\n/g, "\n").trim(),
    city_id: int(fd, "city_id"),
    seo_title: str(fd, "seo_title") || null,
    seo_description: str(fd, "seo_description") || null,
  });
  if (!parsed.success) return fail("Fix the highlighted fields.", zodErrors(parsed.error.issues));
  const v = parsed.data;
  if (db.prepare("SELECT 1 FROM articles WHERE slug = ? AND id IS NOT ?").get(v.slug, id)) return fail("Another article already uses this slug.", { slug: "Taken" });

  let cover: string | null | undefined = undefined;
  const file = fd.get("cover");
  if (file instanceof File && file.size > 0) {
    const up = await saveUpload(file, ["image"]);
    if (!up.ok) return fail(up.error, { cover: up.error });
    cover = up.file.url;
  } else if (fd.get("remove_cover") === "on") cover = null;

  const now = nowIso();
  const existing = id ? (db.prepare("SELECT status, published_at, cover_url FROM articles WHERE id = ?").get(id) as { status: string; published_at: string | null; cover_url: string | null } | undefined) : undefined;
  if (id && !existing) return fail("Article not found.");
  const status = intent === "publish" ? "published" : intent === "unpublish" ? "draft" : existing?.status ?? "draft";
  const published_at = status === "published" ? existing?.published_at ?? now : existing?.published_at ?? null;
  const coverUrl = cover === undefined ? existing?.cover_url ?? null : cover;

  let aid = id;
  if (id) {
    db.prepare(`UPDATE articles SET title=?, slug=?, category=?, author_name=?, excerpt=?, body=?, cover_url=?, city_id=?, seo_title=?, seo_description=?, status=?, published_at=?, updated_at=? WHERE id = ?`)
      .run(v.title, v.slug, v.category, v.author_name, v.excerpt, v.body, coverUrl, v.city_id, v.seo_title, v.seo_description, status, published_at, now, id);
  } else {
    aid = Number(db.prepare(`INSERT INTO articles (slug, title, category, author_name, excerpt, body, cover_url, city_id, seo_title, seo_description, status, published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(v.slug, v.title, v.category, v.author_name, v.excerpt, v.body, coverUrl, v.city_id, v.seo_title, v.seo_description, status, published_at).lastInsertRowid);
  }
  await auditAs(me, id ? (intent === "publish" ? "article.publish" : intent === "unpublish" ? "article.unpublish" : "article.update") : intent === "publish" ? "article.create_publish" : "article.create", "article", aid!, { slug: v.slug, status });
  revalidatePath("/news", "layout");
  if (!id) {
    revalidatePath("/admin", "layout");
    redirect(`/admin/cms/${aid}?saved=${status}`);
  }
  return done(status === "published" ? (intent === "publish" ? "Published. It is live on /news." : "Saved; changes are live.") : intent === "unpublish" ? "Moved back to draft; it is no longer public." : "Draft saved.", { slug: v.slug });
}

export async function deleteArticle(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("cms");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const a = db.prepare("SELECT slug, title FROM articles WHERE id = ?").get(id) as { slug: string; title: string } | undefined;
  if (!a) return fail("Article not found.");
  db.prepare("DELETE FROM articles WHERE id = ?").run(id);
  await auditAs(me, "article.delete", "article", id, a);
  revalidatePath("/news", "layout");
  revalidatePath("/admin", "layout");
  redirect("/admin/cms?deleted=1");
}

/* ---------------------------------------------------------------- AD7 static pages */

export async function savePage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("cms");
  if (!me) return NOT_ALLOWED;
  const isNew = fd.get("new") === "1";
  const slug = slugify(str(fd, "slug"));
  const title = str(fd, "title");
  const body = String(fd.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  const errors: Record<string, string> = {};
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) errors.slug = "2–60 chars: a–z, 0–9, -";
  if (title.length < 2) errors.title = "Required";
  if (body.length < 20) errors.body = "Write at least a sentence or two";
  if (Object.keys(errors).length) return fail("Fix the highlighted fields.", errors);
  const exists = db.prepare("SELECT 1 FROM static_pages WHERE slug = ?").get(slug);
  if (isNew && exists) return fail("A page with this slug exists.", { slug: "Taken" });
  if (!isNew && !exists) return fail("Page not found.");
  if (isNew) db.prepare("INSERT INTO static_pages (slug, title, body) VALUES (?,?,?)").run(slug, title, body);
  else db.prepare("UPDATE static_pages SET title = ?, body = ?, updated_at = ? WHERE slug = ?").run(title, body, nowIso(), slug);
  await auditAs(me, isNew ? "page.create" : "page.update", "static_page", null, { slug });
  revalidatePath(`/${slug}`);
  if (isNew) {
    revalidatePath("/admin", "layout");
    redirect(`/admin/cms/pages/${slug}`);
  }
  return done("Page saved; changes are live.");
}

/* ---------------------------------------------------------------- AD7 cities & localities */

const num = (fd: FormData, k: string) => {
  const s = str(fd, k);
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export async function saveCity(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("cms");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id")) || null;
  const name = str(fd, "name"), state = str(fd, "state");
  const slug = slugify(str(fd, "slug") || name);
  const lat = num(fd, "lat"), lng = num(fd, "lng"), sort = int(fd, "sort") ?? 0;
  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Required";
  if (!slug) errors.slug = "Required";
  if (!(STATES as readonly string[]).includes(state)) errors.state = "Pick a state";
  if (lat == null || Number.isNaN(lat) || lat < 6 || lat > 37) errors.lat = "India is 6–37° N";
  if (lng == null || Number.isNaN(lng) || lng < 68 || lng > 98) errors.lng = "India is 68–98° E";
  if (Object.keys(errors).length) return fail("Fix the highlighted fields.", errors);
  if (db.prepare("SELECT 1 FROM cities WHERE slug = ? AND id IS NOT ?").get(slug, id)) return fail("Slug already used.", { slug: "Taken" });
  const launch = bool(fd, "is_launch");
  if (id) {
    db.prepare("UPDATE cities SET name=?, slug=?, state=?, lat=?, lng=?, is_launch=?, sort=? WHERE id = ?").run(name, slug, state, lat, lng, launch, sort, id);
    await auditAs(me, "city.update", "city", id, { name, slug });
    return done(`${name} saved.`);
  }
  const nid = Number(db.prepare("INSERT INTO cities (slug, name, state, lat, lng, is_launch, sort) VALUES (?,?,?,?,?,?,?)").run(slug, name, state, lat, lng, launch, sort).lastInsertRowid);
  await auditAs(me, "city.create", "city", nid, { name, slug });
  return done(`${name} added. Add its localities next.`);
}

const rating = (fd: FormData, k: string, errors: Record<string, string>) => {
  const v = num(fd, k);
  if (v != null && (Number.isNaN(v) || v < 0 || v > 5)) errors[k] = "0–5";
  return v;
};

export async function saveLocality(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("cms");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id")) || null;
  const cityId = Number(fd.get("city_id"));
  const name = str(fd, "name");
  const slug = slugify(str(fd, "slug") || name);
  const lat = num(fd, "lat"), lng = num(fd, "lng");
  const errors: Record<string, string> = {};
  if (!db.prepare("SELECT 1 FROM cities WHERE id = ?").get(cityId)) return fail("Unknown city.");
  if (name.length < 2) errors.name = "Required";
  if (lat == null || Number.isNaN(lat) || lat < 6 || lat > 37) errors.lat = "6–37";
  if (lng == null || Number.isNaN(lng) || lng < 68 || lng > 98) errors.lng = "68–98";
  const r = rating(fd, "rating", errors), c = rating(fd, "connectivity", errors), s = rating(fd, "safety", errors), l = rating(fd, "lifestyle", errors);
  const description = str(fd, "description") || null;
  if (description && description.length > 2000) errors.description = "Too long";
  if (Object.keys(errors).length) return fail("Fix the highlighted fields.", errors);
  if (db.prepare("SELECT 1 FROM localities WHERE city_id = ? AND slug = ? AND id IS NOT ?").get(cityId, slug, id)) return fail("Slug already used in this city.", { slug: "Taken" });
  const trending = bool(fd, "trending");
  if (id) {
    db.prepare("UPDATE localities SET name=?, slug=?, lat=?, lng=?, rating=?, connectivity=?, safety=?, lifestyle=?, description=?, trending=? WHERE id = ? AND city_id = ?")
      .run(name, slug, lat, lng, r, c, s, l, description, trending, id, cityId);
    await auditAs(me, "locality.update", "locality", id, { name, slug, trending });
    return done(`${name} saved.`);
  }
  const nid = Number(db.prepare("INSERT INTO localities (city_id, slug, name, lat, lng, rating, connectivity, safety, lifestyle, description, trending) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(cityId, slug, name, lat, lng, r, c, s, l, description, trending).lastInsertRowid);
  await auditAs(me, "locality.create", "locality", nid, { name, slug, cityId });
  return done(`${name} added.`);
}

export async function toggleTrending(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("cms");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const l = db.prepare("SELECT name, trending FROM localities WHERE id = ?").get(id) as { name: string; trending: number } | undefined;
  if (!l) return fail("Not found.");
  db.prepare("UPDATE localities SET trending = ? WHERE id = ?").run(l.trending ? 0 : 1, id);
  await auditAs(me, `locality.trending.${l.trending ? "off" : "on"}`, "locality", id);
  return done(`${l.name} ${l.trending ? "removed from" : "marked"} trending.`);
}
