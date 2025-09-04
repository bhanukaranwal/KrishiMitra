const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
    serverActions: true,
    optimizeCss: true,
  },
  images: {
    domains: [
      'localhost',
      'krishimitra.com',
      's3.amazonaws.com',
      'storage.googleapis.com',
      'azure.microsoft.com'
    ],
    formats: ['image/avif', 'image/webp'],
  },
  i18n: {
    locales: [
      'en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'ur', 'kn', 'ml', 
      'or', 'pa', 'as', 'mai', 'sa', 'ne', 'ks', 'sd', 'kok', 'mni', 'sit', 'doi'
    ],
    defaultLocale: 'en',
    localeDetection: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss: https:;"
          }
        ]
      }
    ];
  },
  webpack: (config, { dev, isServer }) => {
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    if (!dev && !isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@tensorflow/tfjs$': '@tensorflow/tfjs/dist/tf.min.js',
      };
    }

    return config;
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
    MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN,
    GOOGLE_EARTH_ENGINE_KEY: process.env.GOOGLE_EARTH_ENGINE_KEY,
  },
  output: 'standalone',
};

module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), {
  silent: true,
  org: "krishimitra",
  project: "frontend",
});
