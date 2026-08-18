import type { Element, WeaponType } from "@/domain/models";

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

/**
 * First verified roster-expansion batch.
 *
 * Identity, weapon type and signature-weapon IDs are cross-checked against the
 * promoted WUWA GameDatabase and the current WutheringTools character metadata.
 * Heavy combat data is deliberately not duplicated here: GameDatabase remains
 * the authoritative source for level curves, skills and sequence descriptions.
 */
export const roster10R1 = [
  {
    id: "aemeath",
    name: "Aemeath",
    sourceItemId: "1210",
    rarity: 5,
    element: "fusion",
    weaponType: "sword",
    signatureWeapon: {
      id: "everbright-polestar",
      name: "Everbright Polestar",
      sourceItemId: "21020076",
    },
  },
  {
    id: "augusta",
    name: "Augusta",
    sourceItemId: "1306",
    rarity: 5,
    element: "electro",
    weaponType: "broadblade",
    signatureWeapon: {
      id: "thunderflare-dominion",
      name: "Thunderflare Dominion",
      sourceItemId: "21010026",
    },
  },
  {
    id: "brant",
    name: "Brant",
    sourceItemId: "1206",
    rarity: 5,
    element: "fusion",
    weaponType: "sword",
    signatureWeapon: {
      id: "unflickering-valor",
      name: "Unflickering Valor",
      sourceItemId: "21020026",
    },
  },
  {
    id: "calcharo",
    name: "Calcharo",
    sourceItemId: "1301",
    rarity: 5,
    element: "electro",
    weaponType: "broadblade",
    signatureWeapon: {
      id: "lustrous-razor",
      name: "Lustrous Razor",
      sourceItemId: "21010015",
    },
  },
  {
    id: "cantarella",
    name: "Cantarella",
    sourceItemId: "1607",
    rarity: 5,
    element: "havoc",
    weaponType: "rectifier",
    signatureWeapon: {
      id: "whispers-of-sirens",
      name: "Whispers of Sirens",
      sourceItemId: "21050056",
    },
  },
  {
    id: "carlotta",
    name: "Carlotta",
    sourceItemId: "1107",
    rarity: 5,
    element: "glacio",
    weaponType: "pistols",
    signatureWeapon: {
      id: "the-last-dance",
      name: "The Last Dance",
      sourceItemId: "21030016",
    },
  },
  {
    id: "cartethyia",
    name: "Cartethyia",
    sourceItemId: "1409",
    rarity: 5,
    element: "aero",
    weaponType: "sword",
    signatureWeapon: {
      id: "defiers-thorn",
      name: "Defier's Thorn",
      sourceItemId: "21020036",
    },
  },
  {
    id: "changli",
    name: "Changli",
    sourceItemId: "1205",
    rarity: 5,
    element: "fusion",
    weaponType: "sword",
    signatureWeapon: {
      id: "blazing-brilliance",
      name: "Blazing Brilliance",
      sourceItemId: "21020016",
    },
  },
  {
    id: "chisa",
    name: "Chisa",
    sourceItemId: "1508",
    rarity: 5,
    element: "havoc",
    weaponType: "broadblade",
    signatureWeapon: {
      id: "kumokiri",
      name: "Kumokiri",
      sourceItemId: "21010056",
    },
  },
  {
    id: "ciaccona",
    name: "Ciaccona",
    sourceItemId: "1407",
    rarity: 5,
    element: "aero",
    weaponType: "pistols",
    signatureWeapon: {
      id: "woodland-aria",
      name: "Woodland Aria",
      sourceItemId: "21030036",
    },
  },
] as const satisfies readonly RosterPromotionEntry[];

/** Camellya is intentionally excluded from every roster-promotion batch. */
export const excludedRosterResonatorIds = ["camellya"] as const;

export const roster10R1Ids = roster10R1.map((entry) => entry.id);
