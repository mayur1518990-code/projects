import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "../styles/globals.css";
import { Navbar } from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://projects-user-app.vercel.app";

/**
 * SEO OPTIMIZATION INSTRUCTIONS FOR GOOGLE SEARCH CONSOLE
 * ========================================================
 * 
 * 1. SUBMIT YOUR SITE TO GOOGLE SEARCH CONSOLE:
 *    - Visit: https://search.google.com/search-console
 *    - Add your property: https://projects-user-app.vercel.app
 *    - Verify ownership using one of the provided methods (HTML tag, DNS, etc.)
 * 
 * 2. SUBMIT YOUR SITEMAP:
 *    - After verification, go to "Sitemaps" in the left sidebar
 *    - Enter: https://projects-user-app.vercel.app/sitemap.xml
 *    - Click "Submit"
 *    - Google will automatically crawl your sitemap and index your pages
 * 
 * 3. REQUEST INDEXING FOR KEYWORD PAGE:
 *    - Go to "URL Inspection" tool in Google Search Console
 *    - Enter: https://projects-user-app.vercel.app/matre-data-entry
 *    - Click "Test Live URL" to verify it's accessible
 *    - Click "Request Indexing" to ask Google to crawl and index this page
 *    - Repeat this for the homepage and other important pages
 * 
 * 4. CHECK YOUR RANKING:
 *    - After a few days/weeks, search Google for: "matre data entry"
 *    - Check if your site appears in search results
 *    - Monitor performance in Google Search Console under "Performance" tab
 *    - Track impressions, clicks, and average position for your target keyword
 * 
 * 5. ADDITIONAL SEO TIPS:
 *    - Ensure your site loads quickly (already optimized in next.config.ts)
 *    - Build quality backlinks to your site
 *    - Create fresh content regularly
 *    - Monitor Google Search Console for any issues or errors
 *    - Use the "Performance" report to see which keywords are driving traffic
 * 
 * 6. VERIFY YOUR SITEMAP IS WORKING:
 *    - Visit: https://projects-user-app.vercel.app/sitemap.xml
 *    - You should see an XML sitemap with all your pages listed
 * 
 * 7. VERIFY YOUR ROBOTS.TXT IS WORKING:
 *    - Visit: https://projects-user-app.vercel.app/robots.txt
 *    - You should see rules allowing Google to crawl your site
 */

export const metadata: Metadata = {
  title: "Matre Data Entry | Smart Project Management Platform",
  description: "Matre Data Entry helps users manage and track project information easily using AI-powered tools and automation.",
  keywords: "matre data entry, data entry, project management, AI-powered tools, automation, document processing",
  authors: [{ name: "Matre Data Entry Team" }],
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Matre Data Entry | Smart Project Management Platform",
    description: "Matre Data Entry helps users manage and track project information easily using AI-powered tools and automation.",
    url: siteUrl,
    siteName: "Matre Data Entry",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Matre Data Entry | Smart Project Management Platform",
    description: "Matre Data Entry helps users manage and track project information easily using AI-powered tools and automation.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // JSON-LD Structured Data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Matre Data Entry",
    description: "Matre Data Entry helps users manage and track project information easily using AI-powered tools and automation.",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* JSON-LD Structured Data for better SEO */}
        <Script
          id="website-structured-data"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
