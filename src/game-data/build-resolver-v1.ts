import type { FinalStats } from "@/domain/models";
import type { EchoLoadoutV1, ResolvedEchoLoadoutV1 } from "./echo-loadout";
import { resolveEchoLoadoutV1 } from "./echo-loadout";
import { resolveExactProgressionPoint } from "./progression-resolver";
import type { GameDatabaseV1 } from "./schema";

export interface ExactLevelSelectionV1 {
  level: number;
  /** Required only at levels 20/40/50/60/70/80 where two exact points exist. */
  ascended?: boolean;
}

export interface FinalStatsWithoutEchoesV1 {
  readonly kind: "final-stats-without-echoes-v1";
  readonly stats: FinalStats;
}

export interface EchoBuildResolverInputV1 {
  character: { id: string; progression: ExactLevelSelectionV1 };
  weapon: { id: string; progression: ExactLevelSelectionV1 };
  /** Explicit wrapper prevents accidental reuse of a panel that may already include Echoes. */
  panelWithoutEchoes: FinalStatsWithoutEchoesV1;
  echoLoadout: EchoLoadoutV1;
}

export interface ExactBaseStatBasisV1 {
  hp: number;
  attack: number;
  defense: number;
  characterAttack: number;
  weaponAttack: number;
}

export interface EchoBuildResolverDiagnosticV1 {
  code: "sonata-bonuses-not-applied" | "main-echo-skill-not-applied";
  message: string;
}

export interface ResolvedEchoBuildV1 {
  finalStats: FinalStats;
  baseStatBasis: ExactBaseStatBasisV1;
  echoLoadout: ResolvedEchoLoadoutV1;
  diagnostics: readonly EchoBuildResolverDiagnosticV1[];
}

function fail(message: string): never {
  throw new Error(`Echo Build Resolver V1 rejected input: ${message}`);
}

function finiteNonNegative(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(`${label} must be a finite non-negative number`);
  }
  return value;
}

function safeId(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 200 ||
    /[\u0000-\u001f\u007f-\u009f]/.test(value)
  ) {
    fail(`${label} is invalid`);
  }
  return value;
}

function cloneFinalStats(stats: FinalStats): FinalStats {
  return {
    hp: stats.hp,
    attack: stats.attack,
    defense: stats.defense,
    critRate: stats.critRate,
    critDamage: stats.critDamage,
    energyRegen: stats.energyRegen,
    healingBonus: stats.healingBonus,
    tuneBreakBoost: stats.tuneBreakBoost,
    elementalDamageBonus: { ...stats.elementalDamageBonus },
    damageTypeBonus: { ...stats.damageTypeBonus },
  };
}

function validateFinalStats(stats: FinalStats, label: string) {
  for (const key of [
    "hp",
    "attack",
    "defense",
    "critRate",
    "critDamage",
    "energyRegen",
    "healingBonus",
    "tuneBreakBoost",
  ] as const) {
    finiteNonNegative(stats[key], `${label}.${key}`);
  }
  const expectedElements = ["aero", "glacio", "electro", "fusion", "havoc", "spectro"] as const;
  for (const element of expectedElements) {
    finiteNonNegative(stats.elementalDamageBonus?.[element], `${label}.elementalDamageBonus.${element}`);
  }
  const expectedTypes = [
    "basicAttack",
    "heavyAttack",
    "resonanceSkill",
    "resonanceLiberation",
    "introSkill",
    "echoSkill",
  ] as const;
  for (const type of expectedTypes) {
    finiteNonNegative(stats.damageTypeBonus?.[type], `${label}.damageTypeBonus.${type}`);
  }
}

/**
 * Marks a validated panel as explicitly excluding Echo permanent stats.
 * Callers must not wrap an existing `UserBuild.finalStats` unless they know it
 * was authored without Echoes; this wrapper exists to make that trust boundary
 * visible in code review and at call sites.
 */
export function declareFinalStatsWithoutEchoesV1(
  stats: FinalStats,
): FinalStatsWithoutEchoesV1 {
  validateFinalStats(stats, "panelWithoutEchoes");
  return Object.freeze({
    kind: "final-stats-without-echoes-v1" as const,
    stats: Object.freeze(cloneFinalStats(stats)),
  });
}

function exactBaseBasis(
  database: Pick<GameDatabaseV1, "characters" | "weapons">,
  input: EchoBuildResolverInputV1,
): ExactBaseStatBasisV1 {
  const characterId = safeId(input.character.id, "character.id");
  const weaponId = safeId(input.weapon.id, "weapon.id");
  const character = database.characters.find((entry) => entry.id === characterId);
  if (!character) fail(`unknown character id ${characterId}`);
  const weapon = database.weapons.find((entry) => entry.id === weaponId);
  if (!weapon) fail(`unknown weapon id ${weaponId}`);
  if (weapon.type !== character.weaponType) {
    fail(`weapon ${weaponId} (${weapon.type}) is incompatible with character ${characterId} (${character.weaponType})`);
  }
  if (!character.stats?.hp || !character.stats.attack || !character.stats.defense) {
    fail(`character ${characterId} lacks reviewed HP/ATK/DEF progressions`);
  }
  if (!weapon.baseStats?.attack) {
    fail(`weapon ${weaponId} lacks a reviewed base ATK progression`);
  }

  const characterHp = resolveExactProgressionPoint(
    character.stats.hp,
    input.character.progression,
    `character ${characterId}.hp`,
  ).value;
  const characterAttack = resolveExactProgressionPoint(
    character.stats.attack,
    input.character.progression,
    `character ${characterId}.attack`,
  ).value;
  const characterDefense = resolveExactProgressionPoint(
    character.stats.defense,
    input.character.progression,
    `character ${characterId}.defense`,
  ).value;
  const weaponAttack = resolveExactProgressionPoint(
    weapon.baseStats.attack,
    input.weapon.progression,
    `weapon ${weaponId}.attack`,
  ).value;

  return Object.freeze({
    hp: characterHp,
    attack: characterAttack + weaponAttack,
    defense: characterDefense,
    characterAttack,
    weaponAttack,
  });
}

function applyEchoContributions(
  base: FinalStats,
  basis: ExactBaseStatBasisV1,
  resolvedEchoes: ResolvedEchoLoadoutV1,
): FinalStats {
  const output = cloneFinalStats(base);
  const contributions = resolvedEchoes.contributions;

  output.hp += contributions.flat.hp + basis.hp * (contributions.basePercent.hp / 100);
  output.attack +=
    contributions.flat.attack + basis.attack * (contributions.basePercent.attack / 100);
  output.defense +=
    contributions.flat.defense + basis.defense * (contributions.basePercent.defense / 100);
  output.critRate += contributions.percentagePoints.critRate;
  output.critDamage += contributions.percentagePoints.critDamage;
  output.energyRegen += contributions.percentagePoints.energyRegen;
  output.healingBonus += contributions.percentagePoints.healingBonus;

  for (const element of ["aero", "glacio", "electro", "fusion", "havoc", "spectro"] as const) {
    output.elementalDamageBonus[element] +=
      contributions.percentagePoints.elementalDamageBonus[element];
  }
  for (const type of [
    "basicAttack",
    "heavyAttack",
    "resonanceSkill",
    "resonanceLiberation",
  ] as const) {
    output.damageTypeBonus[type] += contributions.percentagePoints.damageTypeBonus[type];
  }

  validateFinalStats(output, "resolvedFinalStats");
  return output;
}

/**
 * Safe bridge from reviewed generated base stats + an explicit no-Echo panel
 * to a new permanent panel containing exact five-star +25 Echo stat rolls.
 * Sonata bonuses and active Echo-skill effects remain deliberately separate
 * until they have structured reviewed definitions.
 */
export function resolveFinalStatsWithEchoesV1(
  database: Pick<GameDatabaseV1, "characters" | "weapons" | "echoes" | "sonataSets">,
  input: EchoBuildResolverInputV1,
): ResolvedEchoBuildV1 {
  if (input.panelWithoutEchoes?.kind !== "final-stats-without-echoes-v1") {
    fail("panelWithoutEchoes must be created with declareFinalStatsWithoutEchoesV1");
  }
  validateFinalStats(input.panelWithoutEchoes.stats, "panelWithoutEchoes.stats");
  const basis = exactBaseBasis(database, input);
  const echoLoadout = resolveEchoLoadoutV1(database, input.echoLoadout);
  const finalStats = applyEchoContributions(
    input.panelWithoutEchoes.stats,
    basis,
    echoLoadout,
  );

  const diagnostics: EchoBuildResolverDiagnosticV1[] = [];
  if (Object.values(echoLoadout.sonataPieceCounts).some((count) => count >= 2)) {
    diagnostics.push({
      code: "sonata-bonuses-not-applied",
      message:
        "Sonata piece thresholds are counted, but their descriptive source text is not executable. Structured reviewed Sonata effects are required before they can modify finalStats.",
    });
  }
  if (echoLoadout.mainEchoId) {
    diagnostics.push({
      code: "main-echo-skill-not-applied",
      message:
        "The equipped Main Echo is resolved, but its active skill/effects are runtime combat data and are not permanent finalStats.",
    });
  }

  return {
    finalStats,
    baseStatBasis: basis,
    echoLoadout,
    diagnostics,
  };
}
