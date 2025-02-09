import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverSourceMaps: true,
  },
  productionBrowserSourceMaps: true,
 output: 'standalone',
}



export default withPayload(nextConfig)
