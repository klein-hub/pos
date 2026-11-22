import { Link } from 'react-router-dom';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { Icon } from '../components/Icon';
import { CONTACT_EMAIL } from '../components/Layout';
import { industries, services, suites } from '../data/catalog';

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-brand-200/50 blur-3xl" />
        <div className="absolute -bottom-32 left-[-10%] h-[420px] w-[420px] rounded-full bg-harvest-300/30 blur-3xl" />
      </div>

      <div className="container-x grid items-center gap-14 pb-20 pt-14 lg:grid-cols-2 lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-600/20 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700">
            <Sparkles className="h-3.5 w-3.5" /> Now with AI agents built in
          </span>
          <h1 className="h-display mt-5 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Run your whole business from one place.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            Sales, stock, payroll, attendance, expenses and marketing — in one connected suite,
            set up and supported by a local IT team. Built for cafés, farms, food businesses
            and industrial service providers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/pricing" className="btn-primary">See plans <ArrowRight className="h-4 w-4" /></Link>
            <a href={`mailto:${CONTACT_EMAIL}?subject=Book%20a%20demo`} className="btn-outline">Book a demo</a>
          </div>
          <ul className="mt-8 grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
            {['VAT-inclusive pricing & SC/PWD discounts', 'Accept GCash, QR & cards at the counter', 'Costs tracked to the gram', 'Local setup & support'].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-brand-600" />{t}</li>
            ))}
          </ul>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

/** The product, abstracted: a dashboard card and a grid of app tiles. */
function HeroVisual() {
  const tiles = [
    { name: 'Point of Sale', icon: 'ShoppingBag', tone: 'bg-brand-50 text-brand-700' },
    { name: 'Inventory', icon: 'Boxes', tone: 'bg-harvest-300/30 text-harvest-600' },
    { name: 'Payroll', icon: 'Users', tone: 'bg-sky-50 text-sky-700' },
    { name: 'Insights', icon: 'BarChart3', tone: 'bg-rose-50 text-rose-600' },
    { name: 'Expenses', icon: 'Landmark', tone: 'bg-violet-50 text-violet-700' },
    { name: 'Social', icon: 'Megaphone', tone: 'bg-amber-50 text-amber-700' },
  ];
  const bars = [38, 62, 48, 80, 56, 92, 70];
  return (
    <div className="relative">
      <div className="rounded-3xl border border-ink/5 bg-white p-5 shadow-lift">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-ink-mute">Today’s sales</p>
            <p className="font-display text-3xl font-extrabold">₱48,920</p>
          </div>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">Margin 71%</span>
        </div>
        <div className="mt-5 flex h-28 items-end gap-2">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {tiles.map((t) => (
            <div key={t.name} className="flex flex-col items-center gap-2 rounded-2xl border border-ink/5 p-3">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${t.tone}`}><Icon name={t.icon} className="h-5 w-5" /></span>
              <span className="text-[11px] font-medium text-ink-soft">{t.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-ink/5 bg-white px-4 py-3 shadow-card sm:block">
        <p className="text-[11px] text-ink-mute">AI agent</p>
        <p className="text-sm font-semibold">3 posts scheduled for this week</p>
      </div>
    </div>
  );
}

function Suites() {
  return (
    <section id="suites" className="scroll-mt-20 py-20">
      <div className="container-x">
        <div className="max-w-2xl">
          <p className="eyebrow">The Digita suite</p>
          <h2 className="h-display mt-3 text-3xl sm:text-4xl">Everything you need, nothing that doesn’t talk to the rest.</h2>
          <p className="mt-4 text-ink-soft">
            Five suites, one login, one set of records. A sale updates stock; a shift feeds payroll;
            an expense lands on the right branch. Start with what you need and add more as you grow.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {suites.map((s) => (
            <div key={s.id} className="flex flex-col rounded-2xl border border-ink/5 bg-white p-6 shadow-card">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={s.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-xl font-bold">{s.name}</h3>
              <p className="mt-1 text-sm text-ink-soft">{s.tagline}</p>
              <ul className="mt-5 space-y-3">
                {s.products.map((p) => (
                  <li key={p.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{p.name}</span>
                      {p.ai && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">AI</span>}
                      {p.availability === 'soon' && <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-semibold text-ink-mute">Coming soon</span>}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-mute">{p.blurb}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex flex-col justify-between rounded-2xl bg-ink p-6 text-white shadow-card">
            <div>
              <Sparkles className="h-6 w-6 text-harvest-400" />
              <h3 className="mt-4 font-display text-xl font-bold">AI agents, working inside your apps</h3>
              <p className="mt-2 text-sm text-white/70">
                Not a chatbot bolted on the side. Agents that draft your posts, triage service requests
                and — soon — prepare your tax filings, using the records you already keep.
              </p>
            </div>
            <Link to="/pricing" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-harvest-400">
              Included from Scale <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Industries() {
  return (
    <section id="industries" className="scroll-mt-20 bg-white py-20">
      <div className="container-x">
        <div className="max-w-2xl">
          <p className="eyebrow">Industries</p>
          <h2 className="h-display mt-3 text-3xl sm:text-4xl">Built around how your business actually runs.</h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {industries.map((i) => (
            <div key={i.id} className="rounded-2xl border border-ink/5 bg-paper p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-brand-700 shadow-card">
                  <Icon name={i.icon} className="h-5 w-5" />
                </span>
                <h3 className="font-display text-lg font-bold">{i.name}</h3>
              </div>
              <p className="mt-4 text-sm text-ink-mute">{i.problem}</p>
              <p className="mt-2 font-medium">{i.outcome}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {i.highlights.map((h) => (
                  <span key={h} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-ink-soft shadow-card">{h}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="scroll-mt-20 py-20">
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="eyebrow">IT Sourcing</p>
          <h2 className="h-display mt-3 text-3xl sm:text-4xl">Software is half of it. We handle the rest.</h2>
          <p className="mt-4 text-ink-soft">
            Digita began as an IT sourcing company. We still are one — so the devices, the setup
            and the support come from the same team that built your software.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}?subject=IT%20sourcing%20enquiry`} className="btn-outline mt-6">
            Talk to an IT specialist
          </a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <div key={s.name} className="rounded-2xl border border-ink/5 bg-white p-5 shadow-card">
              <Icon name={s.icon} className="h-6 w-6 text-brand-600" />
              <h3 className="mt-3 font-semibold">{s.name}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-mute">{s.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: '01', t: 'Tell us how you run', d: 'A short call about your branches, menu or catalogue, team and the tools you use today.' },
    { n: '02', t: 'We set it up', d: 'Accounts, products, recipes, staff and devices — configured and your existing records moved in.' },
    { n: '03', t: 'Go live, with support', d: 'Your team trains on real data, and a local specialist is a message away after launch.' },
  ];
  return (
    <section className="bg-white py-20">
      <div className="container-x">
        <p className="eyebrow">Getting started</p>
        <h2 className="h-display mt-3 text-3xl sm:text-4xl">Live in days, not months.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-ink/5 bg-paper p-6">
              <span className="font-display text-sm font-extrabold text-brand-600">{s.n}</span>
              <h3 className="mt-2 font-display text-lg font-bold">{s.t}</h3>
              <p className="mt-2 text-sm text-ink-mute">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    { q: 'Do I have to buy every app?', a: 'No. Plans start with point of sale, inventory and sales insights, and you add payroll, attendance and the rest as you grow. Everything shares the same records either way.' },
    { q: 'Does it handle Philippine VAT and discounts?', a: 'Yes. Prices are VAT-inclusive, VAT is computed correctly per sale, and senior citizen and PWD discounts follow the statutory order of VAT exemption before the 20% discount.' },
    { q: 'Can I pay with GCash or Maya?', a: 'Online payment by card (Visa or Mastercard), GCash and Maya is being switched on. Until then we set up your account and invoice you directly. At the counter, the point of sale already records GCash, QR and card payments.' },
    { q: 'Can I keep my data if I leave?', a: 'Yes. Your records are yours, and we export them for you on request.' },
    { q: 'Do you supply the POS hardware?', a: 'We do. As an IT sourcing company we specify, supply and configure terminals, printers, scanners and cash drawers, and support them after.' },
  ];
  return (
    <section className="py-20">
      <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <p className="eyebrow">FAQ</p>
          <h2 className="h-display mt-3 text-3xl sm:text-4xl">Questions, answered.</h2>
        </div>
        <div className="divide-y divide-ink/10 rounded-2xl border border-ink/5 bg-white shadow-card">
          {items.map((i) => (
            <details key={i.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {i.q}
                <span className="text-brand-600 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{i.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="container-x">
      <div className="relative overflow-hidden rounded-3xl bg-brand-700 px-8 py-14 text-white sm:px-14">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/40 blur-2xl" />
        <div className="relative max-w-2xl">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">Ready to see it with your own menu?</h2>
          <p className="mt-3 text-white/80">We’ll walk you through Digita using your products and your numbers.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={`mailto:${CONTACT_EMAIL}?subject=Book%20a%20demo`} className="btn bg-white text-brand-700 hover:bg-white/90">Book a demo</a>
            <Link to="/pricing" className="btn border border-white/30 text-white hover:bg-white/10">Compare plans</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Home() {
  return (
    <>
      <Hero />
      <Suites />
      <Industries />
      <Services />
      <HowItWorks />
      <Faq />
      <CtaBand />
    </>
  );
}
