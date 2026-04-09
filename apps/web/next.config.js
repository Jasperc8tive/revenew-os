const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  pageExtensions: ['ts', 'tsx'],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    };

    return config;
  },
  async redirects() {
    return [
      { source: '/analytics', destination: '/dashboard/analytics', permanent: false },
      { source: '/acquisition', destination: '/dashboard/acquisition', permanent: false },
      { source: '/pipeline', destination: '/dashboard/pipeline', permanent: false },
      { source: '/retention', destination: '/dashboard/retention', permanent: false },
      { source: '/pricing', destination: '/dashboard/pricing', permanent: false },
      { source: '/agents', destination: '/dashboard/agents', permanent: false },
      { source: '/recommendations', destination: '/dashboard/recommendations', permanent: false },
      { source: '/integrations', destination: '/dashboard/integrations', permanent: false },
      { source: '/reports', destination: '/dashboard/reports', permanent: false },
      { source: '/billing', destination: '/dashboard/billing', permanent: false },
      { source: '/settings', destination: '/dashboard/settings', permanent: false },
      { source: '/orders', destination: '/dashboard/orders', permanent: false },
      { source: '/customers', destination: '/dashboard/customers', permanent: false },
      { source: '/messages', destination: '/dashboard/messages', permanent: false },
      { source: '/command-center', destination: '/dashboard/command-center', permanent: false },
      { source: '/verification', destination: '/dashboard/verification', permanent: false },
      { source: '/benchmarking', destination: '/dashboard/benchmarking', permanent: false },
      { source: '/forecasting', destination: '/dashboard/forecasting', permanent: false },
      { source: '/competitive', destination: '/dashboard/competitive', permanent: false },
      { source: '/copilot', destination: '/dashboard/copilot', permanent: false },
      { source: '/help', destination: '/dashboard/help', permanent: false },
      { source: '/experiments/:path*', destination: '/dashboard/experiments/:path*', permanent: false },
    ];
  },
};

module.exports = nextConfig;
