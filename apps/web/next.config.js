/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@foundation/ui', '@foundation/sdk'],
  experimental: {
    optimizePackageImports: ['@foundation/ui', 'lucide-react'],
  },
};

module.exports = nextConfig;
