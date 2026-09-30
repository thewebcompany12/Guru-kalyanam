import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {},
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
