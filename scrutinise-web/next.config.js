/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  output: 'standalone'
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: 'scrutinise',
  project: 'scrutinise-web',
})
