import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uel9brzirf.ufs.sh',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
};

export default nextConfig;