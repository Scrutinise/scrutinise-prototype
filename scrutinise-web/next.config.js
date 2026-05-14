/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/training',
        destination: '/support',
        permanent: true,
      },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: 'scrutinise',
  project: 'scrutinise-web',
})
