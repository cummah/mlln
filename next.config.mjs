import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets a production check build run without touching the folder a running dev server uses
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The old /dashboard section was removed. Old links, bookmarks and search results still land somewhere useful.
  async redirects() {
    return [
      { source: '/asset/compare', destination: '/rank', permanent: true },
      { source: '/dashboard', destination: '/sectors', permanent: true },
      { source: '/dashboard/daily', destination: '/asset/daily', permanent: true },
      { source: '/dashboard/weekly', destination: '/asset/weekly', permanent: true },
      { source: '/dashboard/monthly', destination: '/asset/monthly', permanent: true },
      { source: '/dashboard/:ticker', destination: '/asset/:ticker', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN,
});
