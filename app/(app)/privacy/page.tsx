import { Metadata } from 'next'
import { colors, spacing, typography } from '@/lib/designSystem'

export const metadata: Metadata = {
  title: 'Privacy Policy | mlln.ai',
  description:
    'What mlln.ai collects, what stays in your browser, and what is sent to our servers when you use the site.',
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
    title: 'The short version',
    body: [
      'mlln.ai has no accounts and no sign-up. We do not ask for your name, email address or payment details, and the site does not include advertising or third-party analytics trackers.',
      'Your watchlist, portfolio and display settings are stored in your own browser, not on our servers.',
    ],
  },
  {
    title: 'What is stored in your browser',
    body: [
      'The site uses your browser\'s local storage (not tracking cookies) to remember:',
      <ul key="ls" style={listStyle}>
        <li>your watchlist;</li>
        <li>a portfolio you import or build on the Portfolio page;</li>
        <li>display settings such as signal frequency, base contribution amount and chart range;</li>
        <li>the time of your last watchlist visit, so the page can show what changed since.</li>
      </ul>,
      'This data stays on your device. Clearing your browser\'s site data removes it, and we cannot recover it for you. Because it is not synced, it will not appear on another browser or device.',
    ],
  },
  {
    title: 'What is sent to our servers',
    body: [
      'To show prices, signals and analytics, your browser requests data from our servers. Some of those requests include information you entered:',
      <ul key="sent" style={listStyle}>
        <li>the tickers in your watchlist or portfolio, so we can look up their data;</li>
        <li>the percentage weights you give each holding in a portfolio, so we can calculate portfolio-level analytics;</li>
        <li>the sector of each holding, which comes from our own data.</li>
      </ul>,
      'These details are sent in the web address of the request. The site itself does not save them to a database or link them to you. We do not receive share counts, account numbers or brokerage logins.',
    ],
  },
  {
    title: 'Logs kept by our hosting provider',
    body: [
      'Like most websites, the infrastructure that serves mlln.ai records standard technical information about requests, such as IP address, browser type, time and the requested address. Those addresses can include the tickers and weights described above. This is used to run, secure and troubleshoot the service. We do not use it to build profiles of individual visitors.',
    ],
  },
  {
    title: 'Third-party services',
    body: [
      'We use a hosting provider to serve the site and a database provider to store market data. Neither is given your watchlist or portfolio beyond the requests described above. Market prices are collected separately by our own scheduled jobs and do not involve any information about you.',
      'Fonts are bundled with the site when it is built, so loading a page does not send your browser to a font service.',
    ],
  },
  {
    title: 'What we do not do',
    body: [
      <ul key="not" style={listStyle}>
        <li>We do not sell your data.</li>
        <li>We do not run advertising or share data with advertisers.</li>
        <li>We do not collect brokerage credentials or connect to your accounts.</li>
        <li>We do not knowingly collect information from children.</li>
      </ul>,
    ],
  },
  {
    title: 'Your choices and rights',
    body: [
      'For users with accounts, you have the following rights under GDPR and data protection laws:',
      <ul key="rights" style={listStyle}>
        <li><strong>Data portability:</strong> Download all your data as JSON from your account settings</li>
        <li><strong>Data deletion:</strong> Permanently delete your account and all associated data from your account settings</li>
        <li><strong>Email change:</strong> Update your email address at any time</li>
      </ul>,
      'For users without accounts, you can delete everything the site stores about you at any time by clearing site data in your browser. You can also use the site without importing a portfolio or building a watchlist, in which case no personal inputs are sent to us.',
    ],
  },
  {
    title: 'Changes to this policy',
    body: [
      'If we add accounts, payments, analytics or anything else that changes what is collected, we will update this page before it goes live and change the date below.',
    ],
  },
  {
    title: 'Not investment advice',
    body: [
      'Information on mlln.ai is provided for general information and education. It is not investment, tax or legal advice, and past results do not predict future ones.',
    ],
  },
  {
    title: 'Related policies',
    body: [
      'For more information, see our:',
      <ul key="policies" style={listStyle}>
        <li><a href="/terms" style={{ color: 'var(--teal)', textDecoration: 'none', fontWeight: 500 }}>Terms of Service</a> — covers subscriptions, billing, and usage rights</li>
        <li><a href="/cookie-policy" style={{ color: 'var(--teal)', textDecoration: 'none', fontWeight: 500 }}>Cookie Policy</a> — details about cookies and tracking</li>
      </ul>,
    ],
  },
]

export default function PrivacyPage() {
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
          <h1 style={{ fontSize: '32px', fontWeight: 500, color: colors.text, margin: 0 }}>Privacy Policy</h1>
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
