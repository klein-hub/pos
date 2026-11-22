export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#0E7C66" />
        <path d="M9 8h7a8 8 0 010 16H9z" fill="#F7F6F2" />
        <circle cx="22.5" cy="9.5" r="2.5" fill="#F4A62A" />
      </svg>
      <span className={`font-display text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
        Digita
      </span>
    </span>
  );
}
