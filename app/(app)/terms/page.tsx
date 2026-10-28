import { Metadata } from 'next'
import { colors, spacing, typography } from '@/lib/designSystem'

export const metadata: Metadata = {
  title: 'Terms of Service | mlln.ai',
  description: 'Terms of Service for mlln.ai subscriptions and usage.',
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
    title: 'Acceptance of Terms',
    body: [
      'By accessing and using mlln.ai, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.',
    ],
  },
  {
    title: 'Use License',
    body: [
      'Permission is granted to temporarily download one copy of the materials (information or software) on mlln.ai for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:',
      <ul key="license" style={listStyle}>
        <li>Modify or copy the materials</li>
        <li>Use the materials for any commercial purpose or for any public display</li>
        <li>Attempt to decompile or reverse engineer any software contained on the site</li>
        <li>Remove any copyright or other proprietary notations from the materials</li>
        <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
        <li>Use automated tools or bots to access or crawl the site</li>
      </ul>,
    ],
  },
  {
    title: 'Subscriptions and Billing',
    body: [
      'Subscriptions are billed annually in advance. By initiating a subscription, you authorize us to charge your payment method for the subscription fee. Subscription details:',
      <ul key="billing" style={listStyle}>
        <li>Billing occurs annually on the anniversary of your subscription start date</li>
        <li>You will receive a renewal reminder email at least 30 days before renewal</li>
        <li>Renewal charges will use the payment method on file unless you cancel</li>
        <li>If a payment fails, we will attempt to process it again within 3 business days</li>
        <li>Prices are displayed in British pounds (£) and are exclusive of any applicable taxes</li>
      </ul>,
    ],
  },
  {
    title: 'Cancellation and Refunds',
    body: [
      'You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of your current billing period. You retain access until the end of the period you have paid for.',
      'We offer a 30-day money-back guarantee. If you are not satisfied with your subscription within 30 days of purchase, contact support for a full refund.',
      'After 30 days, subscriptions are non-refundable. Cancelling your subscription does not entitle you to any refund for the period already paid.',
    ],
  },
  {
    title: 'User Accounts',
    body: [
      'If you create an account on mlln.ai, you are responsible for maintaining the confidentiality of your login credentials and password. You agree to accept responsibility for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.',
      'You agree not to use the service for any illegal purposes or in violation of any local, state, national, or international law. You agree that you will not share your account with others or use another person\'s account.',
    ],
  },
  {
    title: 'Limitation of Liability',
    body: [
      'The information provided on mlln.ai is for informational purposes only and does not constitute financial, investment, legal, or tax advice. Past performance does not guarantee future results. You should not rely solely on this information when making investment decisions. Consult with qualified financial advisors before making any investment decisions.',
      'To the fullest extent permitted by law, mlln.ai and its providers will not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or use, even if informed of the possibility of such damages.',
      'In no event shall our total liability exceed the amount you paid for your subscription in the 12 months preceding the claim.',
    ],
  },
  {
    title: 'Disclaimer of Warranties',
    body: [
      'The materials on mlln.ai are provided on an "as is" basis without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement of intellectual property rights.',
      'We do not warrant that the service will be uninterrupted or error-free. We do not warrant that defects will be corrected, or that our servers are free of viruses or harmful components.',
    ],
  },
  {
    title: 'Intellectual Property Rights',
    body: [
      'All materials on mlln.ai, including text, graphics, logos, images, and software, are the property of mlln.ai or its content suppliers and are protected by international copyright and trademark laws.',
      'You may not reproduce, distribute, or transmit any materials without prior written permission from mlln.ai.',
    ],
  },
  {
    title: 'Modifications to Terms',
    body: [
      'We reserve the right to modify these terms at any time. Changes will be posted on this page with an updated "Last updated" date. Your continued use of mlln.ai following the posting of revised Terms means that you accept and agree to the changes.',
    ],
  },
  {
    title: 'Termination',
    body: [
      'We may terminate or suspend your account and access to mlln.ai immediately, without prior notice or liability, for any reason, including if you violate these Terms of Service or applicable law.',
      'Upon termination, your right to use the service will immediately cease. All provisions that by their nature should survive termination shall survive.',
    ],
  },
  {
    title: 'Governing Law',
    body: [
      'These Terms of Service are governed by and construed in accordance with the laws of the United Kingdom, and you irrevocably submit to the exclusive jurisdiction of the courts located in England.',
    ],
  },
  {
    title: 'Contact Information',
    body: [
      'If you have any questions about these Terms of Service, please contact us at support@mlln.ai.',
    ],
  },
]

export default function TermsPage() {
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
          <h1 style={{ fontSize: '32px', fontWeight: 500, color: colors.text, margin: 0 }}>Terms of Service</h1>
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
