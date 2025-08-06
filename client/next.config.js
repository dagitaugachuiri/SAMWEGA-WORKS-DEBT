/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Catches React errors
  swcMinify: true, // Faster minification
  output: 'export', // Static export for simple hosting
};

module.exports = nextConfig;