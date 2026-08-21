import Link from "next/link";
import type { ReactNode } from "react";

import { SiteNavigation } from "@/components/site-navigation";

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="wuwa-site-shell v4-theme">
      <aside className="wuwa-shell-rail" aria-label="Navigation WUWA LAB">
        <Link href="/" className="wuwa-shell-brand">
          <span className="wuwa-shell-brand__mark" aria-hidden="true">
            W
          </span>
          <span className="wuwa-shell-brand__copy">
            <span className="wuwa-shell-brand__title">WUWA LAB</span>
            <span className="wuwa-shell-brand__subtitle">Theorycraft</span>
          </span>
        </Link>

        <SiteNavigation />

        <div className="wuwa-shell-status">
          <span className="wuwa-shell-status__label">
            <span className="wuwa-shell-status__dot" aria-hidden="true" />
            Workspace local
          </span>
          <span className="wuwa-shell-status__copy">
            Builds, données et assets restent reliés aux sources validées du calculateur.
          </span>
        </div>
      </aside>

      <div className="wuwa-shell-workspace">
        <header className="wuwa-shell-mobile-header">
          <Link href="/" className="wuwa-shell-brand">
            <span className="wuwa-shell-brand__mark" aria-hidden="true">
              W
            </span>
            <span className="wuwa-shell-brand__copy">
              <span className="wuwa-shell-brand__title">WUWA LAB</span>
              <span className="wuwa-shell-brand__subtitle">Theorycraft</span>
            </span>
          </Link>

          <details className="wuwa-shell-mobile-menu">
            <summary>Navigation</summary>
            <div className="wuwa-shell-mobile-menu__panel">
              <SiteNavigation mobile />
            </div>
          </details>
        </header>

        <div className="wuwa-shell-context" aria-label="Barre d’outils WUWA LAB">
          <Link
            href="/data"
            className="wuwa-shell-search"
            aria-label="Ouvrir Données pour rechercher un personnage, une arme ou un Echo"
          >
            <SearchIcon />
            <span className="wuwa-shell-search__text">
              Rechercher un personnage, une arme, un Echo…
            </span>
            <span className="wuwa-shell-search__hint" aria-hidden="true">
              Données
            </span>
          </Link>

          <div className="wuwa-shell-actions">
            <Link href="/character-box" className="wuwa-shell-action-link">
              Character Box
            </Link>
          </div>
        </div>

        <main className="wuwa-shell-main">{children}</main>

        <footer className="wuwa-shell-footer">
          <div className="wuwa-shell-footer__inner">
            <p>
              <span className="wuwa-shell-footer__brand">WUWA LAB</span> · calculateur communautaire indépendant.
            </p>
            <p>Données vérifiées · contenu externe conservé inerte.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
