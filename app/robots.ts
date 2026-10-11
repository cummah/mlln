import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/asset/', '/api/og/'],
      disallow: ['/api/', '/_next/'],
    },
    sitemap: 'https://mlln.ai/sitemap.xml',
  }
}
