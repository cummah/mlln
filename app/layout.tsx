import '@/styles/globals.css'
import { inter, dmSans } from '@/lib/fonts'

export const metadata = {
  title: 'Enhanced DCA | mlln.ai',
  description: 'Intelligent Dollar Cost Averaging with signal-driven buying',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
