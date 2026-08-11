import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: ['@sst/contracts', '@sst/api-client', '@sst/ui'],
};

export default nextConfig;
