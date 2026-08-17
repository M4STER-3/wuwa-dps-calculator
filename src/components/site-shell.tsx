import Link from "next/link";
import type { ReactNode } from "react";

const primaryNavigation = [
  { href: "/", label: "Accueil" },
  { href: "/character-box", label: "Character Box" },
  { href: "/personal-dps", label: "DPS perso" },
  { href: "/team-dps", label: "DPS équipe" },
  { href: "/echoes", label: "Échos" },
  { href: "/data", label: "Données" },
] as const;

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090b10]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-4 py-3 sm:px-8 lg:px-12">
          <Link href="/" className="group flex shrink-0 items-center gap-3 text-white no-underline">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--accent-strong)] bg-[var(--accent)]/10 text-[var(--accent)] transition group-hover:bg-[var(--accent)]/15">
              ◈
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-black tracking-[0.18em]">WUWA LAB</span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">DPS Calculator</span>
            </span>
          </Link>

          <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-1 lg:flex">
            {primaryNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-[#c5ccd8] no-underline transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-3">
            <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200 sm:inline-flex">
              Calculs vérifiés uniquement
            </span>
            <details className="relative lg:hidden">
              <summary className="list-none rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm font-bold text-white marker:content-none">
                Menu
              </summary>
              <nav className="absolute right-0 mt-2 grid w-56 gap-1 rounded-xl border border-[var(--line)] bg-[#11151d] p-2 shadow-2xl" aria-label="Navigation mobile">
                {primaryNavigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-[#c5ccd8] no-underline hover:bg-white/5 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-white/10 px-4 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>WUWA LAB · calculateur communautaire indépendant.</p>
          <p>Les modules incomplets sont marqués et ne sont jamais présentés comme calculs validés.</p>
        </div>
      </footer>
    </div>
  );
}
