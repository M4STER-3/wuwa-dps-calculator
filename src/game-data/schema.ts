import type { Element, WeaponType } from "@/domain/models";

export type GameEntityKind = "character" | "weapon" | "echo" | "sonata-set";
export type GameDataProvider = "encore";

export interface ExternalIdMap {
  encore?: string;
  wuwa?: string;
}

export interface GeneratedSourceMetadata {
  provider: GameDataProvider;
  externalId: string;
  language: string;
  dataset: "Release";
  importedAt: string;
  sourceVersion?: string;
  sourceHash: string;
}

export interface GameEntityIdentity {
  /** Canonical calculator ID. Never derived at runtime from the display name. */
  id: string;
  /** IDs owned by the game or external providers. */
  externalIds: ExternalIdMap;
  name: string;
  source: GeneratedSourceMetadata;
}

export interface NumericStatProgressionPoint {
  level: number;
  value: number;
  ascended?: boolean;
}

export interface NumericStatProgression {
  points: readonly NumericStatProgressionPoint[];
  /** Exact source values only. Consumers must not silently interpolate missing levels. */
  interpolation: "none";
}

export interface SkillCatalogEntry {
  id: string;
  name: string;
  description?: string;
  sourceParameters?: unknown;
}

export interface SequenceCatalogEntry {
  sequence: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  description: string;
}

export interface CharacterCatalogEntry extends GameEntityIdentity {
  kind: "character";
  rarity: number;
  element: Element;
  weaponType: WeaponType;
  stats?: {
    hp?: NumericStatProgression;
    attack?: NumericStatProgression;
    defense?: NumericStatProgression;
  };
  skills: readonly SkillCatalogEntry[];
  sequences: readonly SequenceCatalogEntry[];
  resource?: { name: string; cap?: number };
}

export interface PassiveRank {
  rank: 1 | 2 | 3 | 4 | 5;
  description: string;
  sourceParameters?: unknown;
}

export interface WeaponCatalogEntry extends GameEntityIdentity {
  kind: "weapon";
  type: WeaponType;
  rarity: number;
  baseStats: {
    attack?: NumericStatProgression;
    secondaryStat?: {
      stat: string;
      /** Encore weapon secondary-stat growth values are reviewed percentage points. */
      unit: "percentage-points";
      progression: NumericStatProgression;
    };
  };
  passive?: {
    name?: string;
    description?: string;
    ranks: readonly PassiveRank[];
  };
}

export type EchoCost = 1 | 3 | 4;

export interface EchoCatalogEntry extends GameEntityIdentity {
  kind: "echo";
  cost: EchoCost;
  sonataSetIds: readonly string[];
  echoSkill?: {
    description: string;
    sourceParameters?: unknown;
  };
  possibleMainStatIds?: readonly string[];
}

export interface SonataSetCatalogEntry extends GameEntityIdentity {
  kind: "sonata-set";
  bonuses: readonly {
    pieces: number;
    description: string;
    sourceParameters?: unknown;
  }[];
}

export type EchoStatApplication = "flat" | "base-percent" | "percentage-point";

export type EchoStatTarget =
  | "hp"
  | "attack"
  | "defense"
  | "critRate"
  | "critDamage"
  | "energyRegen"
  | "healingBonus"
  | `elementalDamageBonus:${Element}`
  | "damageTypeBonus:basicAttack"
  | "damageTypeBonus:heavyAttack"
  | "damageTypeBonus:resonanceSkill"
  | "damageTypeBonus:resonanceLiberation";

export interface EchoMainStatDefinition {
  id: string;
  stat: EchoStatTarget;
  application: EchoStatApplication;
  /** Exact known values only. Missing levels remain unsupported. */
  progression: NumericStatProgression;
}

export interface EchoStatRollDefinition {
  statId: string;
  stat: EchoStatTarget;
  application: EchoStatApplication;
  values: readonly number[];
}

export interface EchoStatTableCatalog {
  /** V1 is intentionally limited to the reviewed endgame rarity. */
  supportedRarity: 5;
  primaryMainStatsByCost: Readonly<Record<EchoCost, readonly EchoMainStatDefinition[]>>;
  fixedSecondaryMainStatByCost: Readonly<Record<EchoCost, EchoMainStatDefinition>>;
  substatRolls: readonly EchoStatRollDefinition[];
  source: {
    kind: "curated-multi-source";
    verifiedAt: string;
    sources: readonly string[];
    notes?: string;
  };
}

export interface GameDatabaseManifest {
  schemaVersion: 1;
  dataset: "Release";
  generatedAt: string;
  sourceProvider: GameDataProvider;
  sourceImportedAt: string;
  sourceVersion?: string;
  counts: {
    characters: number;
    weapons: number;
    echoes: number;
    sonataSets: number;
  };
}

export interface GameDatabaseV1 {
  manifest: GameDatabaseManifest;
  characters: readonly CharacterCatalogEntry[];
  weapons: readonly WeaponCatalogEntry[];
  echoes: readonly EchoCatalogEntry[];
  sonataSets: readonly SonataSetCatalogEntry[];
  echoStats?: EchoStatTableCatalog;
}
