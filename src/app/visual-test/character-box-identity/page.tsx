import { resonators } from "@/data/catalog";
import { requireResonatorUiAssetId } from "@/game-data/resonator-ui-asset-ids";

import { CharacterBoxIdentityShowcase } from "./character-box-identity-showcase";

const entries = resonators
  .filter((resonator) => resonator.source.kind !== "technical-fixture")
  .map((resonator) => ({
    id: resonator.id,
    assetId: requireResonatorUiAssetId(resonator.id),
    name: resonator.name,
    element: resonator.element,
    weaponType: resonator.weaponType,
    rarity: resonator.rarity,
  }));

export default function CharacterBoxIdentityPreviewPage() {
  return <CharacterBoxIdentityShowcase entries={entries} />;
}
