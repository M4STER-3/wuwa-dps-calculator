import { V4Badge, V4Page } from "@/components/ui/v4-ui";

import { AssetShowcase } from "./asset-showcase";
import styles from "./assets-preview.module.css";

export default function V4AssetPreviewPage() {
  return (
    <V4Page>
      <header className={styles.pageHeader}>
        <div>
          <p className="v4-eyebrow">V4 · Étape 5</p>
          <h1 className="v4-page-title">Assets réels, surfaces légères.</h1>
          <p className="v4-lead">
            Ce checkpoint vérifie les vrais portraits, armes et Echoes avant leur intégration dans Character Box. Les anciens blocs sombres du site ne font pas partie de cette direction.
          </p>
        </div>
        <div className={styles.status}>
          <V4Badge tone="accent">Checkpoint assets</V4Badge>
        </div>
      </header>

      <AssetShowcase />
    </V4Page>
  );
}
