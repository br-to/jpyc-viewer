import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    reactCompiler: true,
  },
  transpilePackages: ['@jpyc/sdk-react'],
};

export default nextConfig;
