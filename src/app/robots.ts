import type { MetadataRoute } from "next";

const SITE = process.env.SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/account", "/api", "/login", "/compare"] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
