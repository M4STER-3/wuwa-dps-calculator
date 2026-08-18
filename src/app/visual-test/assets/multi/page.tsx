import { V4Badge, V4Page } from "@/components/ui/v4-ui";

import { MultiResonatorShowcase } from "./multi-resonator-showcase";
import styles from "./multi-resonator.module.css";

export default function V4MultiResonatorAssetPreviewPage() {
  return (
    <V4Page>
      <header className={styles.pageHeader}>
        <div>
          <p className="v4-eyebrow">V4 · Étape 5C</p>
          <h1 className="v4-page-title">Validation multi-Resonators.</h1>
          <p className="v4-lead">
            Ce checkpoint vérifie que la priorité d’assets et le cadrage générique restent cohérents sur plusieurs personnages répartis dans toute la projection.
          </p>
        </div>
        <V4Badge tone="accent">5C · robustesse</V4Badge>
      </header>

      <MultiResonatorShowcase />
    </V4Page>
  );
}
