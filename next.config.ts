import type { NextConfig } from "next";
import withNextIntl from 'next-intl/plugin'

const nextConfig: NextConfig = withNextIntl()({
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'utfs.io',
        port: '',
      },
      {
      protocol: 'https',
      hostname: '*.ufs.sh',
      port: '',
    },
    ],
  },
})

export default nextConfig;