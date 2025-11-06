import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Performance optimizations (stable version compatible)
  experimental: {
    optimizePackageImports: ['firebase', 'firebase/auth', 'firebase/firestore', 'qrcode', 'razorpay'],
  },
  
  // Enable compression
  compress: true,
  
  // Optimize images with blur placeholders
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Optimize Firebase imports
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'firebase/app': 'firebase/app',
        'firebase/auth': 'firebase/auth',
        'firebase/firestore': 'firebase/firestore',
      };
    }
    
    // Better code splitting for production
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            firebase: {
              test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
              name: 'firebase',
              priority: 10,
            },
            razorpay: {
              test: /[\\/]node_modules[\\/]razorpay[\\/]/,
              name: 'razorpay',
              priority: 9,
            },
            qrcode: {
              test: /[\\/]node_modules[\\/]qrcode[\\/]/,
              name: 'qrcode',
              priority: 8,
            },
            commons: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 5,
              minChunks: 2,
            },
          },
        },
      };
    }
    
    return config;
  },
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
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Cache API responses with stale-while-revalidate
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
    ];
  },
  
  serverExternalPackages: ['firebase-admin', 'aws-sdk'],
  
  // Production source maps for debugging without exposing code
  productionBrowserSourceMaps: false,
  
  // Optimize for production
  poweredByHeader: false,
};

export default nextConfig;
