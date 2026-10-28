import '@/styles/globals.css'
import { inter, dmSans } from '@/lib/fonts'
import { ConsentBanner } from '@/components/layout/ConsentBanner'

export const metadata = {
  title: 'Enhanced DCA | mlln.ai',
  description: 'Intelligent Dollar Cost Averaging with signal-driven buying',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'Enhanced DCA | mlln.ai',
    description: 'Intelligent Dollar Cost Averaging with signal-driven buying',
    url: 'https://mlln.ai',
    siteName: 'mlln.ai',
    images: [
      {
        url: 'https://mlln.ai/og-image.png',
        width: 1200,
        height: 630,
        alt: 'mlln.ai Enhanced DCA',
      },
    ],
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${dmSans.variable}`}>
      <head>
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            async
            defer
          />
        )}
      </head>
      <body>
        {children}
        <ConsentBanner />
      </body>
    </html>
  )
}
