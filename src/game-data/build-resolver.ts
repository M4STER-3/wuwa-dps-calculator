import type { ActiveEffectInstance } from "@/domain/effect-models";
import type { FinalStats } from "@/domain/models";
import type { EchoLoadoutV1, ResolvedEchoLoadoutV1 } from "./echo-loadout";
import { resolveEchoLoadoutV1 } from "./echo-loadout";
import {
  applyPermanentBuildEffectsV1,
  coveredPermanentSourceKeysV1,
  materializeBuildRuntimeEffectsV1,
  permanentBuildSourceKeyV1,
  type BuildEffectSourceV1,
  type PermanentBuildEffectAuditEntryV1,
} from "./build-effects";
import type {
  CharacterCatalogEntry,
  GameDatabaseV1,
  NumericStatProgression,
  SonataSetCatalogEntry,
  WeaponCatalogEntry,
} from "./schema";

export interface ExactBuildStatInputV1 {
  characterId: string;
  characterLevel: number;
  /** Required only at reviewed ascension-cap levels that have pre/post values. */
  characterAscended?: boolean;
  weaponId: string;
  weaponLevel: number;
  /** Required only at reviewed ascension-cap levels that have pre/post values. */
  weaponAscended?: boolean;
  echoLoadout: EchoLoadoutV1;
  /**
   * Reviewed, structured source semantics. New characters/weapons/sets extend data
   * through this contract; the resolver never branches on a specific character id.
   */
  buildEffects?: readonly BuildEffectSourceV1[];
}

export type UnresolvedPermanentSourceV1 =
  | { kind: "character-permanent-nodes"; characterId: string }
  | { kind: "weapon-passive"; weaponId: string }
  | { kind: "sonata-bonus"; sonataSetId: string; pieces: number; description: string };

export interface ExactBuildStatResolutionV1 {
  /**
   * Exact stat sheet for all reviewed permanent sources supplied to the resolver.
   * Runtime/conditional effects are returned separately and are never folded into
   * this sheet, preserving UserBuild.finalStats as the single permanent-stat source.
   */
  statSheet: FinalStats;
  complete: boolean;
  coveredPermanentSources: readonly [
    "character-base-stats",
    "weapon-base-stats",
    "weapon-secondary-stat",
    "echo-main-stats",
    "echo-substats",
  ];
  unresolvedPermanentSources: readonly UnresolvedPermanentSourceV1[];
  coveredPermanentSourceKeys: readonly string[];
  permanentEffectAudit: readonly PermanentBuildEffectAuditEntryV1[];
  runtimeEffects: readonly ActiveEffectInstance[];
  echoResolution: ResolvedEchoLoadoutV1;
  exactBase: {
    character: { hp: number; attack: number; defense: number };
    weapon: { attack: number; secondaryStat?: { stat: string; value: number } };
  };
}

const BASELINE_PERCENTAGE_STATS = Object.freeze({
  critRate: 5,
  critDamage: 150,
  energyRegen: 100,
  healingBonus: 0,
  tuneBreakBoost: 0,
});

function fail(message: string): never {
  throw new Error(`Build resolver V1 rejected input: ${message}`);
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) fail(`${label} must be a finite non-negative number`);
  return value;
}

function exactProgressionValue(
  progression: NumericStatProgression | undefined,
  level: number,
  ascended: boolean | undefined,
  label: string,
): number {
  if (!progression || progression.interpolation !== "none") {
    fail(`${label} has no reviewed non-interpolated progression`);
  }
  if (!Number.isInteger(level) || level < 1 || level > 90) {
    fail(`${label} requested invalid level ${level}`);
  }

  const matches = progression.points.filter((point) => point.level === level);
  if (matches.length === 0) fail(`${label} has no exact value at level ${level}`);
  if (matches.length > 2) fail(`${label} has more than two values at level ${level}`);

  if (matches.length === 1) {
    const point = matches[0]!;
    if (point.ascended !== undefined && ascended !== undefined && point.ascended !== ascended) {
      fail(`${label} level ${level} does not match requested ascension state`);
    }
    if (point.ascended === undefined && ascended !== undefined) {
      fail(`${label} level ${level} does not have an ascension-state choice`);
    }
    return finite(point.value, `${label} level ${level}`);
  }

  if (typeof ascended !== "boolean") {
    fail(`${label} level ${level} requires an explicit pre/post ascension choice`);
  }
  const selected = matches.filter((point) => point.ascended === ascended);
  if (selected.length !== 1) {
    fail(`${label} level ${level} has an invalid reviewed ascension mapping`);
  }
  return finite(selected[0]!.value, `${label} level ${level}`);
}

function exactCharacterBase(
  character: CharacterCatalogEntry,
  level: number,
  ascended: boolean | undefined,
) {
  return {
    hp: exactProgressionValue(character.stats?.hp, level, ascended, `${character.id}.hp`),
    attack: exactProgressionValue(character.stats?.attack, level, ascended, `${character.id}.attack`),
    defense: exactProgressionValue(character.stats?.defense, level, ascended, `${character.id}.defense`),
  };
}

function applyWeaponSecondary(
  statSheet: FinalStats,
  basePercent: { hp: number; attack: number; defense: number },
  stat: string,
  value: number,
) {
  switch (stat) {
    case "ATK":
      basePercent.attack += value;
      return;
    case "HP":
      basePercent.hp += value;
      return;
    case "DEF":
      basePercent.defense += value;
      return;
    case "Crit. Rate":
      statSheet.critRate += value;
      return;
    case "Crit. DMG":
      statSheet.critDamage += value;
      return;
    case "Energy Regen":
      statSheet.energyRegen += value;
      return;
    default:
      fail(`weapon secondary stat ${JSON.stringify(stat)} has no reviewed V1 semantic mapping`);
  }
}

function blankStatSheet(): FinalStats {
  return {
    hp: 0,
    attack: 0,
    defense: 0,
    critRate: BASELINE_PERCENTAGE_STATS.critRate,
    critDamage: BASELINE_PERCENTAGE_STATS.critDamage,
    energyRegen: BASELINE_PERCENTAGE_STATS.energyRegen,
    healingBonus: BASELINE_PERCENTAGE_STATS.healingBonus,
    tuneBreakBoost: BASELINE_PERCENTAGE_STATS.tuneBreakBoost,
    elementalDamageBonus: {
      aero: 0,
      glacio: 0,
      electro: 0,
      fusion: 0,
      havoc: 0,
      spectro: 0,
    },
    damageTypeBonus: {
      basicAttack: 0,
      heavyAttack: 0,
      resonanceSkill: 0,
      resonanceLiberation: 0,
      introSkill: 0,
      echoSkill: 0,
    },
  };
}

function collectUnresolvedSources(
  character: CharacterCatalogEntry,
  weapon: WeaponCatalogEntry,
  sonataSets: readonly SonataSetCatalogEntry[],
  pieceCounts: Readonly<Record<string, number>>,
): UnresolvedPermanentSourceV1[] {
  const unresolved: UnresolvedPermanentSourceV1[] = [
    { kind: "character-permanent-nodes", characterId: character.id },
  ];

  if (weapon.passive && (weapon.passive.name || weapon.passive.description || weapon.passive.ranks.length > 0)) {
    unresolved.push({ kind: "weapon-passive", weaponId: weapon.id });
  }

  for (const sonata of sonataSets) {
    const equippedPieces = pieceCounts[sonata.id] ?? 0;
    for (const bonus of sonata.bonuses) {
      if (equippedPieces >= bonus.pieces) {
        unresolved.push({
          kind: "sonata-bonus",
          sonataSetId: sonata.id,
          pieces: bonus.pieces,
          description: bonus.description,
        });
      }
    }
  }
  return unresolved;
}

function permanentSourceKey(source: UnresolvedPermanentSourceV1): string {
  if (source.kind === "character-permanent-nodes") {
    return permanentBuildSourceKeyV1.characterPermanentNodes(source.characterId);
  }
  if (source.kind === "weapon-passive") {
    return permanentBuildSourceKeyV1.weaponPassive(source.weaponId);
  }
  return permanentBuildSourceKeyV1.sonataBonus(source.sonataSetId, source.pieces);
}

export function resolveExactBuildStatSheetV1(
  database: Pick<GameDatabaseV1, "characters" | "weapons" | "echoes" | "sonataSets">,
  input: ExactBuildStatInputV1,
): ExactBuildStatResolutionV1 {
  const characters = new Map(database.characters.map((entry) => [entry.id, entry]));
  const weapons = new Map(database.weapons.map((entry) => [entry.id, entry]));
  if (characters.size !== database.characters.length) fail("database contains duplicate character IDs");
  if (weapons.size !== database.weapons.length) fail("database contains duplicate weapon IDs");

  const character = characters.get(input.characterId);
  if (!character) fail(`unknown character ${input.characterId}`);
  const weapon = weapons.get(input.weaponId);
  if (!weapon) fail(`unknown weapon ${input.weaponId}`);
  if (weapon.type !== character.weaponType) {
    fail(`weapon ${weapon.id} (${weapon.type}) is incompatible with ${character.id} (${character.weaponType})`);
  }

  const characterBase = exactCharacterBase(character, input.characterLevel, input.characterAscended);
  const weaponAttack = exactProgressionValue(
    weapon.baseStats.attack,
    input.weaponLevel,
    input.weaponAscended,
    `${weapon.id}.attack`,
  );
  const echoResolution = resolveEchoLoadoutV1(
    { echoes: database.echoes, sonataSets: database.sonataSets },
    input.echoLoadout,
  );

  const statSheet = blankStatSheet();
  const basePercent = {
    hp: echoResolution.contributions.basePercent.hp,
    attack: echoResolution.contributions.basePercent.attack,
    defense: echoResolution.contributions.basePercent.defense,
  };

  let secondaryStat: { stat: string; value: number } | undefined;
  if (weapon.baseStats.secondaryStat) {
    if (weapon.baseStats.secondaryStat.unit !== "percentage-points") {
      fail(`${weapon.id} secondary stat has an unsupported unit`);
    }
    const value = exactProgressionValue(
      weapon.baseStats.secondaryStat.progression,
      input.weaponLevel,
      input.weaponAscended,
      `${weapon.id}.secondaryStat`,
    );
    secondaryStat = { stat: weapon.baseStats.secondaryStat.stat, value };
    applyWeaponSecondary(statSheet, basePercent, secondaryStat.stat, secondaryStat.value);
  }

  statSheet.hp =
    characterBase.hp * (1 + basePercent.hp / 100) + echoResolution.contributions.flat.hp;
  statSheet.attack =
    (characterBase.attack + weaponAttack) * (1 + basePercent.attack / 100) +
    echoResolution.contributions.flat.attack;
  statSheet.defense =
    characterBase.defense * (1 + basePercent.defense / 100) +
    echoResolution.contributions.flat.defense;

  const points = echoResolution.contributions.percentagePoints;
  statSheet.critRate += points.critRate;
  statSheet.critDamage += points.critDamage;
  statSheet.energyRegen += points.energyRegen;
  statSheet.healingBonus += points.healingBonus;
  for (const element of Object.keys(statSheet.elementalDamageBonus) as Array<keyof FinalStats["elementalDamageBonus"]>) {
    statSheet.elementalDamageBonus[element] += points.elementalDamageBonus[element];
  }
  for (const type of Object.keys(points.damageTypeBonus) as Array<keyof typeof points.damageTypeBonus>) {
    statSheet.damageTypeBonus[type] += points.damageTypeBonus[type];
  }

  const buildEffects = input.buildEffects ?? [];
  const permanentEffects = applyPermanentBuildEffectsV1(
    statSheet,
    {
      hp: characterBase.hp,
      attack: characterBase.attack + weaponAttack,
      defense: characterBase.defense,
    },
    buildEffects,
  );
  const resolvedStatSheet = permanentEffects.statSheet;

  for (const [key, value] of Object.entries({
    hp: resolvedStatSheet.hp,
    attack: resolvedStatSheet.attack,
    defense: resolvedStatSheet.defense,
    critRate: resolvedStatSheet.critRate,
    critDamage: resolvedStatSheet.critDamage,
    energyRegen: resolvedStatSheet.energyRegen,
    healingBonus: resolvedStatSheet.healingBonus,
    tuneBreakBoost: resolvedStatSheet.tuneBreakBoost,
  })) {
    finite(value, `resolved ${key}`);
  }

  const coveredPermanentSourceKeys = coveredPermanentSourceKeysV1(buildEffects);
  const unresolvedPermanentSources = collectUnresolvedSources(
    character,
    weapon,
    database.sonataSets,
    echoResolution.sonataPieceCounts,
  ).filter((source) => !coveredPermanentSourceKeys.has(permanentSourceKey(source)));
  const runtimeEffects = materializeBuildRuntimeEffectsV1(input.characterId, buildEffects);

  return {
    statSheet: resolvedStatSheet,
    complete: unresolvedPermanentSources.length === 0,
    coveredPermanentSources: [
      "character-base-stats",
      "weapon-base-stats",
      "weapon-secondary-stat",
      "echo-main-stats",
      "echo-substats",
    ],
    unresolvedPermanentSources,
    coveredPermanentSourceKeys: [...coveredPermanentSourceKeys].sort(),
    permanentEffectAudit: permanentEffects.audit,
    runtimeEffects,
    echoResolution,
    exactBase: {
      character: characterBase,
      weapon: {
        attack: weaponAttack,
        ...(secondaryStat ? { secondaryStat } : {}),
      },
    },
  };
}
