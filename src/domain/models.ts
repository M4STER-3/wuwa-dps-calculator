export const elements = [
  "aero",
  "glacio",
  "electro",
  "fusion",
  "havoc",
  "spectro",
] as const;
export type Element = (typeof elements)[number];

export const weaponTypes = [
  "broadblade",
  "gauntlets",
  "pistols",
  "rectifier",
  "sword",
] as const;
export type WeaponType = (typeof weaponTypes)[number];

export const skillTypes = [
  "basicAttack",
  "resonanceSkill",
  "forteCircuit",
  "resonanceLiberation",
  "introSkill",
] as const;
export type SkillType = (typeof skillTypes)[number];

export const damageTypes = [
  "basicAttack",
  "heavyAttack",
  "resonanceSkill",
  "resonanceLiberation",
  "introSkill",
  "echoSkill",
] as const;

export type Sequence = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Rarity = 4 | 5;

export interface SourceMetadata {
  kind: "verified-game-data" | "editorial-recommendation" | "technical-fixture";
  source: string;
  url?: string;
  gameVersion?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface Resonator {
  id: string;
  name: string;
  element: Element;
  weaponType: WeaponType;
  rarity: Rarity;
  portrait?: { src: string; alt: string; attribution?: string };
  skillNames: Readonly<Record<SkillType, string>>;
  resonanceChain: ReadonlyArray<{
    sequence: Exclude<Sequence, 0>;
    name: string;
    description: string;
  }>;
  source: SourceMetadata;
}

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  rarity: Rarity;
  passiveDescription?: string;
  source: SourceMetadata;
}

export interface Sonata {
  id: string;
  name: string;
  effectDescription?: string;
  source: SourceMetadata;
}

export interface MainEcho {
  id: string;
  name: string;
  sonataIds: readonly string[];
  skillDescription?: string;
  source: SourceMetadata;
}

export interface FinalStats {
  hp: number;
  attack: number;
  defense: number;
  critRate: number;
  critDamage: number;
  energyRegen: number;
  healingBonus: number;
  elementalDamageBonus: Record<Element, number>;
  damageTypeBonus: Record<(typeof damageTypes)[number], number>;
}

export interface RecommendedBuildPreset {
  id: string;
  resonatorId: string;
  label: string;
  role?: string;
  characterLevel: number;
  sequence: Sequence;
  skillLevels: Record<SkillType, number>;
  weapon: { weaponId: string; level: number; rank: number };
  finalStats: FinalStats;
  sonataId?: string;
  mainEchoId?: string;
  notes: readonly string[];
  source: SourceMetadata;
}

export interface UserBuild {
  id: string;
  resonatorId: string;
  sourcePresetId: string;
  characterLevel: number;
  sequence: Sequence;
  skillLevels: Record<SkillType, number>;
  weapon: { weaponId: string; level: number; rank: number };
  finalStats: FinalStats;
  sonataId?: string;
  mainEchoId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterBox {
  schemaVersion: 1;
  builds: UserBuild[];
}
