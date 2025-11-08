/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client']
  },
  output: 'standalone',
  // Force bind to 0.0.0.0
  server: {
    host: '0.0.0.0',
    port: process.env.PORT || 3000
  }
}

module.exports = nextConfig