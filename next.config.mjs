/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The old /dashboard section was removed. Old links, bookmarks and search results still land somewhere useful.
  async redirects() {
    return [
      { source: '/dashboard', destination: '/sectors', permanent: true },
      { source: '/dashboard/daily', destination: '/asset/daily', permanent: true },
      { source: '/dashboard/weekly', destination: '/asset/weekly', permanent: true },
      { source: '/dashboard/monthly', destination: '/asset/monthly', permanent: true },
      { source: '/dashboard/:ticker', destination: '/asset/:ticker', permanent: true },
    ];
  },
};

export default nextConfig;
