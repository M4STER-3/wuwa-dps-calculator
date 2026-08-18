import type { Resonator, Weapon } from "@/domain/models";
import {
  generatedCharacterBoxRoster10R1,
  generatedCharacterBoxWeapons10R1,
} from "@/generated/character-box-roster-10r1";

const projectedSource = {
  kind: "verified-game-data" as const,
  source: "WUWA GameDatabase V1 · Release projection",
  notes:
    "Projection build-time whitelisted par ID Wuthering Waves. Les données lourdes et métadonnées source ne sont pas exposées au navigateur.",
};

export const roster10R1PromotedResonators: readonly Resonator[] =
  generatedCharacterBoxRoster10R1.map((entry) => ({
    id: entry.id,
    name: entry.name,
    element: entry.element,
    weaponType: entry.weaponType,
    rarity: entry.rarity,
    skillNames: entry.skillNames,
    resonanceChain: entry.resonanceChain,
    source: {
      ...projectedSource,
      notes: `${projectedSource.notes} Wuwa ID ${entry.sourceItemId}.`,
    },
  }));

export const roster10R1PromotedWeapons: readonly Weapon[] =
  generatedCharacterBoxWeapons10R1.map((entry) => ({
    id: entry.id,
    name: entry.name,
    type: entry.type,
    rarity: entry.rarity,
    source: {
      ...projectedSource,
      notes: `${projectedSource.notes} Wuwa ID ${entry.sourceItemId}.`,
    },
  }));
