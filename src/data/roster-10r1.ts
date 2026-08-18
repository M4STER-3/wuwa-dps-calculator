import type { Element, WeaponType } from "@/domain/models";
import registry from "./roster-promotion-registry.json";

export interface RosterPromotionEntry {
  readonly id: string;
  readonly name: string;
  readonly sourceItemId: string;
  readonly rarity: 5;
  readonly element: Element;
  readonly weaponType: WeaponType;
  readonly signatureWeapon: {
    readonly id: string;
    readonly name: string;
    readonly sourceItemId: string;
  };
}

const elementMap: Readonly<Record<string, Element>> = {
  Aero: "aero",
  Glacio: "glacio",
  Electro: "electro",
  Fusion: "fusion",
  Havoc: "havoc",
  Spectro: "spectro",
};

const weaponTypeMap: Readonly<Record<string, WeaponType>> = {
  Broadblade: "broadblade",
  Gauntlets: "gauntlets",
  Pistols: "pistols",
  Rectifier: "rectifier",
  Sword: "sword",
};

function requiredElement(value: string): Element {
  const mapped = elementMap[value];
  if (!mapped) throw new Error(`Unsupported roster registry element: ${value}`);
  return mapped;
}

function requiredWeaponType(value: string): WeaponType {
  const mapped = weaponTypeMap[value];
  if (!mapped) throw new Error(`Unsupported roster registry weapon type: ${value}`);
  return mapped;
}

/**
 * Typed Character Box view of the universal promotion registry.
 * Future roster batches should add reviewed data to roster-promotion-registry.json
 * instead of duplicating IDs across UI, baseline and media generators.
 */
export const roster10R1: readonly RosterPromotionEntry[] = registry.batches["10R1"].map(
  (entry): RosterPromotionEntry => {
    if (entry.rarity !== 5) {
      throw new Error(`Unsupported promoted rarity for ${entry.id}: ${entry.rarity}`);
    }
    return {
      id: entry.id,
      name: entry.name,
      sourceItemId: entry.wuwaId,
      rarity: 5,
      element: requiredElement(entry.element),
      weaponType: requiredWeaponType(entry.weaponType),
      signatureWeapon: {
        id: entry.signatureWeapon.id,
        name: entry.signatureWeapon.name,
        sourceItemId: entry.signatureWeapon.wuwaId,
      },
    };
  },
);

/** Camellya is intentionally excluded from every roster-promotion batch. */
export const excludedRosterResonatorIds: readonly string[] =
  registry.excludedResonatorIds;

if (!excludedRosterResonatorIds.includes("camellya")) {
  throw new Error("Camellya must remain explicitly excluded from roster promotion");
}

export const roster10R1Ids = roster10R1.map((entry) => entry.id);
