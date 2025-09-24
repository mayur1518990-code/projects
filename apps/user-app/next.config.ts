import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
        ],
      },
    ];
  },
  serverExternalPackages: ['firebase-admin'],
  eslint: {
    // Skip ESLint errors during production builds (Vercel)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Optionally skip type errors during builds; remove if you want strict CI
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
