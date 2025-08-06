/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Catches React errors
  swcMinify: true, // Faster minification
  experimental: {
    webpackBuildWorker: true, // Matches your build log
  },
  env: {
    // Essential environment variables
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  },
  webpack: (config, { isServer }) => {
    // Fix Firebase client-side issues
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;