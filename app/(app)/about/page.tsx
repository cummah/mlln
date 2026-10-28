import { Metadata } from 'next'
import { colors, spacing, typography } from '@/lib/designSystem'

export const metadata: Metadata = {
  title: 'About | mlln.ai',
  description: 'About mlln.ai — Intelligent Dollar Cost Averaging with signal-driven buying.',
}

export const dynamic = 'force-static'

interface Block {
  title: string
  body: React.ReactNode[]
}

const BLOCKS: Block[] = [
  {
    title: 'What is mlln.ai?',
    body: [
      'mlln.ai is an intelligent Dollar Cost Averaging (DCA) platform that helps investors build wealth through systematic, signal-driven investment strategies. We combine market analysis with behavioral economics to identify optimal buying opportunities.',
    ],
  },
  {
    title: 'Our Mission',
    body: [
      'We believe consistent, disciplined investing is more important than perfect timing. mlln.ai empowers everyday investors to make data-driven decisions without emotional bias, combining technical analysis, market signals, and proven DCA principles.',
    ],
  },
  {
    title: 'Key Features',
    body: [
      <ul key="features" style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        <li><strong>Signal-driven buying:</strong> Identify optimal entry points using multi-factor analysis</li>
        <li><strong>Portfolio analytics:</strong> Visualize performance, drawdowns, and diversification</li>
        <li><strong>Sector insights:</strong> Monitor sector-level trends and relative performance</li>
        <li><strong>Weekly & monthly views:</strong> Customize your analysis timeframe</li>
      </ul>,
    ],
  },
  {
    title: 'Company Information',
    body: [
      <div key="company" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>
          <strong>Company:</strong> mlln.ai<br />
          <strong>Email:</strong> <a href="mailto:support@mlln.ai" style={{ color: 'var(--teal)', textDecoration: 'none' }}>support@mlln.ai</a><br />
          <strong>Jurisdiction:</strong> United Kingdom
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: colors.text2 }}>
          mlln.ai is operated under UK law and complies with UK data protection regulations including the UK GDPR.
        </p>
      </div>,
    ],
  },
  {
    title: 'Disclaimer',
    body: [
      'mlln.ai is provided for educational and informational purposes only. Nothing on this site constitutes financial, investment, legal, or tax advice. Past performance does not guarantee future results. Always conduct your own research and consult with qualified financial advisors before making investment decisions.',
      'The information and analysis provided on mlln.ai are based on publicly available data and historical patterns. Markets are inherently unpredictable, and actual results may differ significantly from projections or historical performance.',
    ],
  },
]

export default function AboutPage() {
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
          <h1 style={{ fontSize: '32px', fontWeight: 500, color: colors.text, margin: 0 }}>About mlln.ai</h1>
          <p style={{ fontSize: typography.fontSize.lg, color: colors.text3, margin: 0 }}>Intelligent Dollar Cost Averaging with signal-driven buying</p>
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
