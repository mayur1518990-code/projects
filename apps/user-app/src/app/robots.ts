import { MetadataRoute } from "next";

const siteUrl = "https://projects-user-app.vercel.app";

/**
 * ROBOTS.TXT FOR SEO
 * ==================
 * This file tells search engines which pages they can crawl and index.
 * 
 * Current configuration:
 * - Allows all search engines to crawl all pages (userAgent: "*", allow: "/")
 * - Blocks crawling of API routes and Next.js internal files
 * - Points to the sitemap location
 * 
 * Verify it's working by visiting: https://projects-user-app.vercel.app/robots.txt
 */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/_next/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

