import { resonators } from "@/data/catalog";
import { V4Badge, V4Page } from "@/components/ui/v4-ui";
import { requireResonatorUiAssetId } from "@/game-data/resonator-ui-asset-ids";

import {
  CharacterBoxStructurePreview,
  type CharacterBoxStructureResonator,
} from "./character-box-structure-preview";
import styles from "./character-box-structure.module.css";

const structureEntries: CharacterBoxStructureResonator[] = resonators
  .filter((entry) => entry.source.kind !== "technical-fixture")
  .map((entry) => ({
    id: entry.id,
    assetId: requireResonatorUiAssetId(entry.id),
    name: entry.name,
    element: entry.element,
    weaponType: entry.weaponType,
    rarity: entry.rarity,
  }));

export default function V4CharacterBoxStructurePage() {
  return (
    <V4Page>
      <header className={styles.pageHeader}>
        <div>
          <p className="v4-eyebrow">V4 · Étape 7</p>
          <h1 className="v4-page-title">Character Box devient un vrai atelier de build.</h1>
          <p className="v4-lead">
            Ce checkpoint valide uniquement l’architecture du futur workspace : hiérarchie visuelle, navigation entre Resonators, emplacement des stats, de l’arme, des Echoes et de l’analyse. Les valeurs et éditeurs détaillés arrivent aux étapes suivantes.
          </p>
        </div>
        <div className={styles.statuses}>
          <V4Badge tone="accent">Structure Character Box</V4Badge>
          <V4Badge tone="success">Aucune écriture locale</V4Badge>
        </div>
      </header>

      <CharacterBoxStructurePreview entries={structureEntries} />
    </V4Page>
  );
}
