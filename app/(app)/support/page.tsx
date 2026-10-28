import { Metadata } from 'next';
import { colors, spacing, typography } from '@/lib/designSystem';
import { ContactForm } from '@/components/support/ContactForm';

export const metadata: Metadata = {
  title: 'Support | mlln.ai',
  description: 'Get help with mlln.ai, FAQs, and contact support.',
};

export const dynamic = 'force-static';

const listStyle = {
  margin: 0,
  paddingLeft: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.md,
} as const;

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: "What is mlln.ai?",
    a: "mlln.ai is a DCA (dollar cost averaging) analysis platform. It backtests two strategies—standard DCA with fixed weekly purchases and Enhanced DCA that scales entries by market signal indicators—across 2,000+ stocks and ETFs.",
  },
  {
    q: "Do I need an account to use the site?",
    a: "No. You can explore the Free tier without signing up. To save watchlists, customize DCA amounts, or access signal-based portfolios, you'll need to create an account and choose a paid plan.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit and debit cards via Revolut. Your billing is recurring on your chosen plan. You can upgrade, downgrade, or cancel any time from your account settings.",
  },
  {
    q: "What are the tier differences?",
    a: "Free tier is read-only; Essential includes basic portfolio building; Full Access adds signal-based entry timing; Pro includes live daily signals and advanced analytics. See the pricing page for full details.",
  },
  {
    q: "How often are prices updated?",
    a: "Prices are updated daily after US market close (Eastern Time). Signals and analytics are rebuilt each night and the site is refreshed.",
  },
  {
    q: "Is this financial advice?",
    a: "No. mlln.ai provides backtest analytics and historical signal information for education. It is not investment, tax, or legal advice. Past performance does not guarantee future results. Always consult a qualified advisor before making investment decisions.",
  },
  {
    q: "How do I delete my account?",
    a: 'Go to your account settings and click "Delete Account". Your data will be permanently removed. This action cannot be undone.',
  },
  {
    q: "Can I export my data?",
    a: "Yes. From your account settings, you can download a JSON file of all your account data, including watchlists, portfolios, and settings.",
  },
  {
    q: "What data do you collect?",
    a: "We collect your email, tier, and account activity (watchlist changes, portfolio edits). We do not collect personal information beyond what you provide. See our Privacy Policy for details.",
  },
  {
    q: "Do you use third-party analytics?",
    a: "We use first-party analytics to understand how the site is used. You can opt in or out via the consent banner at the bottom of the page.",
  },
];

export default function SupportPage() {
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
          <h1 style={{ fontSize: '32px', fontWeight: 500, color: colors.text, margin: 0 }}>Support</h1>
          <p style={{ fontSize: typography.fontSize.lg, color: colors.text3, margin: 0 }}>
            Answers to common questions and contact us
          </p>
        </header>

        {/* FAQ Section */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
          <h2 style={{ fontSize: typography.fontSize['5xl'], fontWeight: 500, color: colors.text, margin: 0 }}>
            Frequently asked questions
          </h2>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.lg,
              fontSize: '14px',
              lineHeight: 1.7,
              color: colors.text2,
            }}
          >
            {FAQS.map((faq, idx) => (
              <div key={idx}>
                <div style={{ fontWeight: 600, color: colors.text, marginBottom: spacing.sm }}>
                  {faq.q}
                </div>
                <div>{faq.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Form Section */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
          <h2 style={{ fontSize: typography.fontSize['5xl'], fontWeight: 500, color: colors.text, margin: 0 }}>
            Get in touch
          </h2>

          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: spacing.lg,
            }}
          >
            <ContactForm />
          </div>

          <p style={{ fontSize: '13px', color: colors.text3, margin: 0 }}>
            You can also reach us at{' '}
            <a href="mailto:support@mlln.ai" style={{ color: 'var(--teal)', textDecoration: 'none' }}>
              support@mlln.ai
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
