import Link from "next/link";
import type { ReactNode } from "react";

import { SiteNavigation } from "@/components/site-navigation";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="wuwa-site-shell">
      <aside className="wuwa-shell-rail" aria-label="Navigation WUWA LAB">
        <Link href="/" className="wuwa-shell-brand">
          <span className="wuwa-shell-brand__mark" aria-hidden="true">
            W
          </span>
          <span className="wuwa-shell-brand__copy">
            <span className="wuwa-shell-brand__title">WUWA LAB</span>
            <span className="wuwa-shell-brand__subtitle">Theorycraft workspace</span>
          </span>
        </Link>

        <SiteNavigation />

        <div className="wuwa-shell-status">
          <span className="wuwa-shell-status__label">
            <span className="wuwa-shell-status__dot" aria-hidden="true" />
            Calculs vérifiés uniquement
          </span>
          <span className="wuwa-shell-status__copy">
            Les modules incomplets restent identifiés et ne sont jamais présentés comme résultats validés.
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
            <summary>Menu</summary>
            <div className="wuwa-shell-mobile-menu__panel">
              <SiteNavigation mobile />
            </div>
          </details>
        </header>

        <div className="wuwa-shell-context" aria-label="Contexte de l’espace de travail">
          <div className="wuwa-shell-context__identity">
            <span className="wuwa-shell-context__kicker">WUWA LAB</span>
            <span className="wuwa-shell-context__name">Wuthering Waves theorycraft calculator</span>
          </div>
          <span className="wuwa-shell-context__meta">Visual system · Phase 1</span>
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
