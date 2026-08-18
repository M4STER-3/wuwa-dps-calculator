import { resonators } from "@/data/catalog";
import { V4Badge, V4Page, V4Panel } from "@/components/ui/v4-ui";
import {
  WuwaResonatorSelector,
  type ResonatorSelectorEntry,
} from "@/components/ui/wuwa-resonator-selector";

import styles from "./resonator-selector-preview.module.css";

const selectorEntries: ResonatorSelectorEntry[] = resonators
  .filter((entry) => entry.source.kind !== "technical-fixture")
  .map((entry) => ({
    id: entry.id,
    name: entry.name,
    element: entry.element,
    weaponType: entry.weaponType,
    rarity: entry.rarity,
  }));

export default function V4ResonatorSelectorPreviewPage() {
  return (
    <V4Page>
      <header className={styles.pageHeader}>
        <div>
          <p className="v4-eyebrow">V4 · Étape 6</p>
          <h1 className="v4-page-title">Choisir un Resonator doit être instantané.</h1>
          <p className="v4-lead">
            Premier composant interactif destiné à remplacer le picker sombre de Character Box : portraits réels, filtres tactiles, recherche rapide et sélection lisible sans toucher encore aux builds persistés.
          </p>
        </div>
        <div className={styles.status}>
          <V4Badge tone="accent">Sélecteur visuel</V4Badge>
          <V4Badge tone="success">IDs stables</V4Badge>
        </div>
      </header>

      <V4Panel className={styles.selectorPanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className="v4-eyebrow">Catalogue Resonators</p>
            <h2 className={styles.panelTitle}>Sélection rapide</h2>
            <p className={styles.panelCopy}>
              Cette preview n’écrit rien dans la Character Box. Elle valide uniquement l’ergonomie, la densité, les états sélectionnés et la réutilisation des assets locaux sécurisés.
            </p>
          </div>
          <span className={styles.count}>{selectorEntries.length} disponibles</span>
        </div>

        <WuwaResonatorSelector
          entries={selectorEntries}
          initialSelectedId={selectorEntries[0]?.id}
        />
      </V4Panel>
    </V4Page>
  );
}
