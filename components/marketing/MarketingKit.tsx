import Link from 'next/link'
import { Reveal } from '@/components/home/Motion'

// Shared layout for the informational pages (about, methodology, score criteria, support).
// Mirrors the home and pricing pages: same hero, eyebrow, panel, FAQ and CTA treatments.
const MARKETING_CSS = `
.lp-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
.lp-hero { position: relative; overflow: hidden; }
.lp-hero-inner { position: relative; padding-top: 76px; padding-bottom: 72px; }
.lp-section { padding: 84px 0; }
.lp-section-band { background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.lp-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--teal); margin-bottom: 14px; }
.lp-h1 { font-size: 54px; font-weight: 700; letter-spacing: -0.035em; line-height: 1.05; margin: 0; max-width: 820px; color: var(--text); }
.lp-lead { font-size: 18px; line-height: 1.6; color: var(--text-2); margin: 22px 0 0; max-width: 640px; }
.lp-h2 { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; margin: 0; color: var(--text); }
.lp-h3 { font-size: 17px; font-weight: 600; line-height: 1.35; margin: 0; color: var(--text); }
.lp-body { font-size: 15px; line-height: 1.7; color: var(--text-2); margin: 0; }
.lp-small { font-size: 12px; line-height: 1.6; color: var(--text-3); margin: 0; }
.lp-stack { display: flex; flex-direction: column; gap: 18px; }
.lp-grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.lp-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.lp-two { display: grid; grid-template-columns: 1fr 1.15fr; gap: 56px; align-items: start; }
.lp-split { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 72px; align-items: start; }
.lp-toc { position: sticky; top: 96px; display: flex; flex-direction: column; border-left: 1px solid var(--border); }
.lp-toc a { font-size: 13px; color: var(--text-3); text-decoration: none; padding: 6px 0 6px 14px; margin-left: -1px; border-left: 2px solid transparent; transition: color 0.2s, border-color 0.2s; }
.lp-toc a:hover { color: var(--text); border-left-color: var(--teal); }
.lp-main { display: flex; flex-direction: column; gap: 72px; min-width: 0; }
.lp-anchor { scroll-margin-top: 96px; }
.lp-panel { background: var(--surface-elevated); border: 1px solid var(--border-elevated); border-radius: 16px; padding: 24px 26px; box-shadow: var(--shadow-md), var(--inset-top); box-sizing: border-box; }
.lp-tile { background: var(--bg); border: 1px solid var(--border); border-radius: 14px; padding: 26px; height: 100%; box-sizing: border-box; }
.lp-tile-surface { background: var(--surface); }
.lp-card { transition: transform 0.25s, border-color 0.25s; }
.lp-card:hover { transform: translateY(-4px); border-color: var(--teal-mid) !important; }
.lp-num { font-family: 'DM Mono', monospace; font-size: 13px; color: var(--teal); }
.lp-chip { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 999px; color: var(--teal); background: var(--teal-dim); border: 1px solid var(--teal-mid); white-space: nowrap; }
.lp-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 28px; }
.lp-btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; transition: background 0.2s, box-shadow 0.2s, transform 0.2s; }
.lp-btn:hover { transform: translateY(-2px); }
.lp-btn-primary { background: var(--teal); color: var(--bg); }
.lp-btn-primary:hover { background: var(--teal-strong); box-shadow: var(--shadow-glow-teal); }
.lp-btn-ghost { color: var(--text); border: 1px solid var(--border-medium); }
.lp-btn-ghost:hover { background: var(--surface2); }
.lp-text-link { color: var(--teal); text-decoration: none; font-weight: 500; font-size: 14px; }
.lp-text-link:hover { text-decoration: underline; }
.lp-link { color: var(--text-2); text-decoration: none; font-size: 12px; font-weight: 500; transition: color 0.2s; }
.lp-link:hover { color: var(--text); }
.lp-orb { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
.lp-orb-a { width: 460px; height: 460px; background: rgba(0,196,167,0.16); top: -120px; right: -80px; animation: lp-float 14s ease-in-out infinite; }
.lp-orb-b { width: 380px; height: 380px; background: rgba(57,135,229,0.12); bottom: -140px; left: -100px; animation: lp-float 18s ease-in-out infinite reverse; }
.lp-cta { position: relative; overflow: hidden; border-top: 1px solid var(--border); }
.lp-cta-inner { position: relative; text-align: center; padding-top: 84px; padding-bottom: 84px; }
.lp-cta-title { font-size: 38px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.15; margin: 0; color: var(--text); }
.lp-cta-body { font-size: 16px; color: var(--text-2); margin: 14px 0 0; }
.lp-cta .lp-actions { justify-content: center; }
.lp-faq { display: flex; flex-direction: column; }
.lp-faq details { border-top: 1px solid var(--border); padding: 18px 0; }
.lp-faq details:last-child { border-bottom: 1px solid var(--border); }
.lp-faq summary { cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 16px; font-size: 15px; font-weight: 500; color: var(--text); }
.lp-faq summary::-webkit-details-marker { display: none; }
.lp-faq summary::after { content: '+'; font-family: 'DM Mono', monospace; font-size: 18px; line-height: 1; color: var(--teal); flex-shrink: 0; }
.lp-faq details[open] summary::after { content: '–'; }
.lp-faq-a { font-size: 14px; line-height: 1.7; color: var(--text-2); margin: 12px 0 0; padding-right: 32px; }
.lp-bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); }
.lp-footer-inner { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding: 28px 24px; font-size: 12px; color: var(--text-3); }
.lp-footer-links { display: flex; gap: 20px; flex-wrap: wrap; }
@keyframes lp-float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-30px, 24px); } }
@media (max-width: 900px) {
  .lp-grid3 { grid-template-columns: 1fr; }
  .lp-two { grid-template-columns: 1fr; gap: 32px; }
  .lp-split { grid-template-columns: 1fr; gap: 32px; }
  .lp-toc { position: static; border-left: none; flex-direction: row; flex-wrap: wrap; gap: 4px 18px; }
  .lp-toc a { padding: 4px 0; margin-left: 0; border-left: none; }
  .lp-toc a:hover { border-left-color: transparent; text-decoration: underline; }
  .lp-section { padding: 64px 0; }
  .lp-h1 { font-size: 40px; }
  .lp-cta-title { font-size: 30px; }
}
@media (max-width: 600px) {
  .lp-grid2 { grid-template-columns: 1fr; }
  .lp-h1 { font-size: 34px; }
  .lp-h2 { font-size: 26px; }
  .lp-lead { font-size: 16px; }
  .lp-hero-inner { padding-top: 52px; padding-bottom: 48px; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-orb { animation: none; }
  .lp-card { transition: none; }
}
`

export function MarketingStyles() {
  return <style dangerouslySetInnerHTML={{ __html: MARKETING_CSS }} />
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="lp-eyebrow">{children}</div>
}

export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string
  title: string
  lead?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="lp-hero">
      <div className="lp-orb lp-orb-a" />
      <div className="lp-orb lp-orb-b" />
      <div className="lp-wrap lp-hero-inner">
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="lp-h1">{title}</h1>
        </Reveal>
        {lead && (
          <Reveal delay={0.16}>
            <div className="lp-lead">{lead}</div>
          </Reveal>
        )}
        {children && <Reveal delay={0.24}>{children}</Reveal>}
      </div>
    </section>
  )
}

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="lp-faq">
      {items.map(f => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p className="lp-faq-a">{f.a}</p>
        </details>
      ))}
    </div>
  )
}

export interface CtaAction {
  label: string
  href: string
  primary?: boolean
}

export function CtaBand({ title, body, actions }: { title: string; body?: string; actions: CtaAction[] }) {
  return (
    <section className="lp-cta">
      <div className="lp-orb lp-orb-a" style={{ top: '-200px' }} />
      <div className="lp-wrap lp-cta-inner">
        <Reveal>
          <h2 className="lp-cta-title">{title}</h2>
          {body && <p className="lp-cta-body">{body}</p>}
          <div className="lp-actions">
            {actions.map(a => (
              <Link key={a.href} href={a.href} className={`lp-btn ${a.primary ? 'lp-btn-primary' : 'lp-btn-ghost'}`}>
                {a.label}
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function MarketingFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)' }}>
      <div className="lp-wrap lp-footer-inner">
        <span>© {new Date().getFullYear()} mlln.ai. Not financial advice. Past performance does not predict future results.</span>
        <nav className="lp-footer-links" aria-label="Footer">
          <Link href="/pricing" className="lp-link">Pricing</Link>
          <Link href="/methodology" className="lp-link">Methodology</Link>
          <Link href="/score-criteria" className="lp-link">Score criteria</Link>
          <Link href="/support" className="lp-link">Support</Link>
          <Link href="/privacy" className="lp-link">Privacy</Link>
          <Link href="/terms" className="lp-link">Terms</Link>
        </nav>
      </div>
    </footer>
  )
}
