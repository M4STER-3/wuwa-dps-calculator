import Link from "next/link";
import type { ReactNode } from "react";

import { SiteNavigation } from "@/components/site-navigation";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="wuwa-site-shell">
      <a className="wuwa-shell-skip" href="#wuwa-main-content">
        Aller au contenu
      </a>

      <header className="wuwa-shell-header">
        <div className="wuwa-shell-header__inner">
          <Link href="/" className="wuwa-shell-brand" aria-label="WUWA LAB — Accueil">
            <span className="wuwa-shell-brand__mark" aria-hidden="true">
              <span>W</span>
            </span>
            <span className="wuwa-shell-brand__copy">
              <strong className="wuwa-shell-brand__title">WUWA LAB</strong>
              <span className="wuwa-shell-brand__subtitle">Resonance analysis system</span>
            </span>
          </Link>

          <div className="wuwa-shell-desktop-nav">
            <SiteNavigation />
          </div>

          <div className="wuwa-shell-actions">
            <span className="wuwa-shell-integrity">
              <span className="wuwa-shell-integrity__dot" aria-hidden="true" />
              Base vérifiée
            </span>

            <details className="wuwa-shell-mobile-menu">
              <summary aria-label="Ouvrir la navigation">
                <span aria-hidden="true">☰</span>
                Menu
              </summary>
              <div className="wuwa-shell-mobile-menu__panel">
                <SiteNavigation mobile />
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="wuwa-shell-workspace">
        <main id="wuwa-main-content" className="wuwa-shell-main" tabIndex={-1}>
          {children}
        </main>

        <footer className="wuwa-shell-footer">
          <div className="wuwa-shell-footer__inner">
            <div>
              <strong className="wuwa-shell-footer__brand">WUWA LAB</strong>
              <span> · theorycraft communautaire indépendant</span>
            </div>
            <div className="wuwa-shell-footer__meta">
              Calculs séparés des données permanentes · texte externe non exécutable
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
