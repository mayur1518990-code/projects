import { MetadataRoute } from "next";

const siteUrl = "https://projects-user-app.vercel.app";

/**
 * SITEMAP FOR SEO
 * ===============
 * This sitemap helps Google discover and index all pages on your site.
 * 
 * IMPORTANT: After deploying, submit this sitemap to Google Search Console:
 * 1. Go to https://search.google.com/search-console
 * 2. Navigate to "Sitemaps" section
 * 3. Submit: https://projects-user-app.vercel.app/sitemap.xml
 * 
 * The /matre-data-entry page is set with high priority (0.9) to help with SEO
 * for the target keyword "matre data entry".
 */

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/matre-data-entry`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/upload`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/files`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}

