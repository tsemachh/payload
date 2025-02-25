import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverSourceMaps: true,
  },
  productionBrowserSourceMaps: true,
 output: 'standalone',
  webpack: (config, { dev }) => {
    config.cache = false;
    if (!dev) {
      config.devtool = 'source-map';
    }
    return config;
  },
}



export default withPayload(nextConfig)
