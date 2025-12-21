import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverSourceMaps: true,
    serverActions: {
      bodySizeLimit: '50mb', // הגדלת מגבלת ה-body ל־50MB
    },
  },
  productionBrowserSourceMaps: true,
  output: 'standalone',
  headers: async () => {
    const appVersion = process.env.APP_VERSION || process.env.BUILD_TIME || 'dev'
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'X-App-Version',
            value: appVersion,
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
            key: 'X-App-Version', 
            value: appVersion,
          },
          {
            key: 'ETag',
            value: `"${appVersion}"`,
          },
        ],
      },
    ]
  },
  webpack: (config, { dev }) => {
    config.cache = false;
    if (!dev) {
      config.devtool = 'source-map';
    }
    return config;
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
