import { Metadata } from 'next'
import { colors, spacing, typography } from '@/lib/designSystem'

export const metadata: Metadata = {
  title: 'Cookie Policy | mlln.ai',
  description: 'How mlln.ai uses cookies and your privacy choices.',
}

export const dynamic = 'force-static'

const UPDATED = '28 October 2026'

const listStyle = {
  margin: 0,
  paddingLeft: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.md,
} as const

interface Block {
  title: string
  body: React.ReactNode[]
}

const BLOCKS: Block[] = [
  {
    title: 'What are cookies?',
    body: [
      'Cookies are small text files that are stored on your device when you visit a website. They are widely used to remember information about you, such as your login status and preferences. Cookies can be either "session cookies" (deleted when you close your browser) or "persistent cookies" (stored on your device for a longer period).',
    ],
  },
  {
    title: 'Cookies we use',
    body: [
      'mlln.ai uses only essential authentication cookies. These cookies are necessary for the service to function and cannot be disabled:',
      <ul key="cookies" style={listStyle}>
        <li><strong>Authentication cookies:</strong> Used by Supabase to maintain your login session and remember you when you return to the site. These contain session tokens that allow us to verify your identity.</li>
        <li><strong>Session state:</strong> Temporary cookies used to maintain your preferences and settings during your visit.</li>
      </ul>,
      'We do not use:',
      <ul key="nocookies" style={listStyle}>
        <li>Advertising or tracking cookies</li>
        <li>Third-party analytics cookies</li>
        <li>Marketing or personalization cookies</li>
      </ul>,
    ],
  },
  {
    title: 'Third-party services',
    body: [
      'mlln.ai uses the following third-party services which may set their own cookies:',
      <ul key="third" style={listStyle}>
        <li><strong>Supabase:</strong> Our database and authentication provider. Visit their privacy policy at supabase.com/privacy for information about their cookie usage.</li>
        <li><strong>Cloudflare Turnstile:</strong> Optional CAPTCHA service for account security. Only active if you attempt to sign up or reset your password. Visit their privacy policy for details.</li>
      </ul>,
    ],
  },
  {
    title: 'Cookie consent',
    body: [
      'Because mlln.ai only uses essential cookies necessary for authentication and service operation, we do not require explicit consent before setting them. These cookies are exempt from cookie consent requirements in most jurisdictions because they are strictly necessary for the service to function.',
      'If you prefer not to accept cookies, you can adjust your browser settings to decline them. However, this may prevent you from using certain features of mlln.ai, such as logging in to your account.',
    ],
  },
  {
    title: 'Managing cookies',
    body: [
      'Most browsers allow you to control cookies through their settings. You can typically:',
      <ul key="manage" style={listStyle}>
        <li>View all cookies stored on your device</li>
        <li>Delete cookies from specific websites</li>
        <li>Block all cookies or only third-party cookies</li>
        <li>Set your browser to ask before accepting cookies</li>
      </ul>,
      'Instructions for popular browsers:',
      <ul key="browsers" style={listStyle}>
        <li>Chrome: settings/privacy-and-security/cookies-and-other-site-data</li>
        <li>Firefox: preferences/privacy-and-security/cookies-and-site-data</li>
        <li>Safari: preferences/privacy/manage-website-data</li>
        <li>Edge: settings/privacy-search-and-services/clear-browsing-data/cookies</li>
      </ul>,
    ],
  },
  {
    title: 'Changes to this policy',
    body: [
      'We may update this Cookie Policy from time to time. When we do, we will update the "Last updated" date at the top of this page. Please review this policy periodically to stay informed about how we use cookies.',
    ],
  },
  {
    title: 'Contact us',
    body: [
      'If you have any questions about our use of cookies, please contact us at support@mlln.ai.',
    ],
  },
]

export default function CookiePolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: colors.bg }}>
      <div
        style={{
          maxWidth: '820px',
          marginLeft: 'auto',
          marginRight: 'auto',
          padding: `${spacing['5xl']} ${spacing['4xl']}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          <h1 style={{ fontSize: '32px', fontWeight: 500, color: colors.text, margin: 0 }}>Cookie Policy</h1>
          <p style={{ fontSize: typography.fontSize.lg, color: colors.text3, margin: 0 }}>Last updated {UPDATED}</p>
        </header>

        {BLOCKS.map(b => (
          <section key={b.title} style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
            <h2 style={{ fontSize: typography.fontSize['5xl'], fontWeight: 500, color: colors.text, margin: 0 }}>
              {b.title}
            </h2>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.xl,
                fontSize: '14px',
                lineHeight: 1.7,
                color: colors.text2,
              }}
            >
              {b.body.map((node, i) => (typeof node === 'string' ? <p key={i} style={{ margin: 0 }}>{node}</p> : node))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
