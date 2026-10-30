import { Metadata } from 'next';
import Link from 'next/link';
import { colors } from '@/lib/designSystem';
import { Reveal } from '@/components/home/Motion';
import { ContactForm } from '@/components/support/ContactForm';
import { FaqList, MarketingFooter, MarketingStyles, PageHero } from '@/components/marketing/MarketingKit';

export const metadata: Metadata = {
  title: 'Support | mlln.ai',
  description: 'Get help with mlln.ai, FAQs, and contact support.',
};

export const dynamic = 'force-static';

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

const TOPICS = [
  {
    title: 'How the model works',
    desc: 'The ideas behind Enhanced DCA, the research it draws on, and its limits.',
    href: '/methodology',
    cta: 'Read the methodology',
  },
  {
    title: 'Plans and billing',
    desc: 'What each plan includes, how billing renews, and how to upgrade or cancel.',
    href: '/pricing',
    cta: 'Compare plans',
  },
  {
    title: 'Something else?',
    desc: 'If your question is not covered below, send us a message and we will reply by email.',
    href: '#contact',
    cta: 'Contact us',
  },
];

export default function SupportPage() {
  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <MarketingStyles />

      <PageHero eyebrow="Support" title="How can we help?" lead="Answers to common questions and contact us" />

      {/* Topic shortcuts */}
      <section className="lp-wrap" style={{ paddingTop: '24px', paddingBottom: '24px' }}>
        <div className="lp-grid3">
          {TOPICS.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.08}>
              <Link href={t.href} className="lp-tile lp-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textDecoration: 'none', color: 'inherit' }}>
                <h2 className="lp-h3">{t.title}</h2>
                <p className="lp-body" style={{ fontSize: '14px', flex: 1 }}>{t.desc}</p>
                <span className="lp-text-link" style={{ marginTop: '6px' }}>{t.cta} →</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section">
        <div className="lp-wrap" style={{ maxWidth: '820px' }}>
          <Reveal>
            <div className="lp-eyebrow">Frequently asked questions</div>
            <h2 className="lp-h2">Answers to common questions</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <div style={{ marginTop: '28px' }}>
              <FaqList items={FAQS} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="lp-section lp-section-band lp-anchor">
        <div className="lp-wrap lp-two">
          <Reveal>
            <div className="lp-eyebrow">Get in touch</div>
            <h2 className="lp-h2">Send us a message</h2>
            <p className="lp-body" style={{ marginTop: '18px', fontSize: '15px' }}>
              Tell us what you need and we will reply by email. You can also write to us directly at{' '}
              <a href="mailto:support@mlln.ai" className="lp-text-link">support@mlln.ai</a>.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="lp-panel">
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
