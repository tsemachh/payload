import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverSourceMaps: true,
  },
  productionBrowserSourceMaps: true,
 output: 'standalone',
  webpack: (config) => {
    config.cache = false;
    return config;
  },
}



export default withPayload(nextConfig)
