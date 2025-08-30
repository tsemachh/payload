import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverSourceMaps: true,
  },
  productionBrowserSourceMaps: true,
  output: 'standalone',
  headers: async () => [
    {
      source: '/_next/static/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
    {
      source: '/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-cache, no-store, must-revalidate',
        },
        {
          key: 'Pragma',
          value: 'no-cache',
        },
        {
          key: 'Expires',
          value: '0',
        },
      ],
    },
  ],
  webpack: (config, { dev }) => {
    config.cache = false;
    if (!dev) {
      config.devtool = 'source-map';
    }
    return config;
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
