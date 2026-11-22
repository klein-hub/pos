import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';

export const HUB_URL = import.meta.env.VITE_HUB_URL ?? 'http://localhost:5175';
export const CONTACT_EMAIL = 'info@digita.tech';

const nav = [
  { to: '/#suites', label: 'Products' },
  { to: '/#industries', label: 'Industries' },
  { to: '/#services', label: 'IT Sourcing' },
  { to: '/pricing', label: 'Pricing' },
];

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname, hash } = useLocation();

  useEffect(() => setOpen(false), [pathname, hash]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-40 transition ${scrolled ? 'bg-paper/85 shadow-[0_1px_0_rgba(11,27,43,.06)] backdrop-blur' : 'bg-transparent'}`}>
      <div className="container-x flex h-16 items-center justify-between">
        <Link to="/" aria-label="Digita home"><Logo /></Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink">
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a href={HUB_URL} className="btn-ghost">Sign in</a>
          <Link to="/pricing" className="btn-primary">Get started</Link>
        </div>

        <button className="rounded-lg p-2 md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-ink/5 bg-paper md:hidden">
          <div className="container-x flex flex-col gap-1 py-3">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-lg px-3 py-2.5 text-sm font-medium">{n.label}</Link>
            ))}
            <a href={HUB_URL} className="rounded-lg px-3 py-2.5 text-sm font-medium">Sign in</a>
            <Link to="/pricing" className="btn-primary mt-2">Get started</Link>
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 bg-ink text-white/70">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">
            Business software and IT sourcing for growing SMEs in the Philippines —
            built for food, agriculture and industrial service businesses.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Product</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/#suites" className="hover:text-white">Suites</Link></li>
            <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
            <li><a href={HUB_URL} className="hover:text-white">Sign in</a></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Company</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/#services" className="hover:text-white">IT Sourcing</Link></li>
            <li><a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white">{CONTACT_EMAIL}</a></li>
            <li>Taguig, Metro Manila</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col justify-between gap-2 py-5 text-xs sm:flex-row">
          <span>© {new Date().getFullYear()} Digita Advanced Information Solutions OPC</span>
          <span>Prices in Philippine pesos, VAT inclusive where applicable.</span>
        </div>
      </div>
    </footer>
  );
}

/** Scroll to an in-page anchor after navigation, since the router does not. */
function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return null;
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToHash />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
