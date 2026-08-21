import { damageBonusTypes, type Element, type FinalStats } from "@/domain/models";
import type { UserEchoLoadoutV1 } from "@/domain/user-echo-loadout";
import { reviewedEchoStatTableV1 } from "./echo-stats-v1";
import type { EchoStatApplication, EchoStatTarget } from "./schema";

type DamageBonusType = (typeof damageBonusTypes)[number];

export interface EchoLoadoutBaseStatBasisV1 {
  hp: number;
  attack: number;
  defense: number;
}

export interface EchoLoadoutStatAuditEntryV1 {
  echoIndex: number;
  source: "primary-main" | "fixed-secondary" | "substat";
  statId: string;
  target: EchoStatTarget;
  application: EchoStatApplication;
  value: number;
  contribution: number;
}

export interface EchoLoadoutStatResolutionV1 {
  finalStats: FinalStats;
  audit: readonly EchoLoadoutStatAuditEntryV1[];
}

const clone = (stats: FinalStats): FinalStats => ({
  ...stats,
  elementalDamageBonus: { ...stats.elementalDamageBonus },
  damageTypeBonus: { ...stats.damageTypeBonus },
});

function apply(
  stats: FinalStats,
  basis: EchoLoadoutBaseStatBasisV1,
  target: EchoStatTarget,
  application: EchoStatApplication,
  value: number,
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Echo stat ${target} has an invalid value.`);
  }

  if (target === "hp" || target === "attack" || target === "defense") {
    const contribution =
      application === "flat" ? value : basis[target] * value / 100;
    stats[target] += contribution;
    return contribution;
  }

  if (application !== "percentage-point") {
    throw new Error(`Echo stat ${target} requires percentage-point application.`);
  }

  if (
    target === "critRate" ||
    target === "critDamage" ||
    target === "energyRegen" ||
    target === "healingBonus"
  ) {
    stats[target] += value;
    return value;
  }

  if (target.startsWith("elementalDamageBonus:")) {
    const element = target.slice("elementalDamageBonus:".length) as Element;
    if (!(element in stats.elementalDamageBonus)) {
      throw new Error(`Unknown Echo elemental target ${target}.`);
    }
    stats.elementalDamageBonus[element] += value;
    return value;
  }

  if (target.startsWith("damageTypeBonus:")) {
    const damageType = target.slice("damageTypeBonus:".length) as DamageBonusType;
    if (!damageBonusTypes.includes(damageType)) {
      throw new Error(`Unknown Echo damage-type target ${target}.`);
    }
    stats.damageTypeBonus[damageType] += value;
    return value;
  }

  throw new Error(`Unsupported Echo stat target ${target}.`);
}

const primaryIndex = new Map(
  Object.entries(reviewedEchoStatTableV1.primaryMainStatsByCost).flatMap(
    ([rawCost, definitions]) =>
      definitions.map((definition) => [
        definition.id,
        { cost: Number(rawCost) as 1 | 3 | 4, definition },
      ] as const),
  ),
);
const substatIndex = new Map(
  reviewedEchoStatTableV1.substatRolls.map((definition) => [
    definition.statId,
    definition,
  ] as const),
);

function level25Value(points: readonly { level: number; value: number }[]): number {
  const matches = points.filter((point) => point.level === 25);
  if (matches.length !== 1) throw new Error("Echo main stat requires one exact level-25 value.");
  return matches[0]!.value;
}

/**
 * Applies only permanent stats explicitly present in a persisted five-Echo loadout.
 * No Sonata/passive bonus is included here; those remain separate data-owned effects.
 */
export function applyEchoLoadoutStatsV1(
  panelWithoutEchoes: FinalStats,
  basis: EchoLoadoutBaseStatBasisV1,
  loadout: UserEchoLoadoutV1,
): EchoLoadoutStatResolutionV1 {
  const finalStats = clone(panelWithoutEchoes);
  const audit: EchoLoadoutStatAuditEntryV1[] = [];

  for (const [echoIndex, echo] of loadout.echoes.entries()) {
    const primary = primaryIndex.get(echo.primaryMainStatId);
    if (!primary) {
      throw new Error(`Unknown Echo main stat ${echo.primaryMainStatId}.`);
    }
    const primaryValue = level25Value(primary.definition.progression.points);
    audit.push({
      echoIndex,
      source: "primary-main",
      statId: primary.definition.id,
      target: primary.definition.stat,
      application: primary.definition.application,
      value: primaryValue,
      contribution: apply(
        finalStats,
        basis,
        primary.definition.stat,
        primary.definition.application,
        primaryValue,
      ),
    });

    const secondary = reviewedEchoStatTableV1.fixedSecondaryMainStatByCost[primary.cost];
    const secondaryValue = level25Value(secondary.progression.points);
    audit.push({
      echoIndex,
      source: "fixed-secondary",
      statId: secondary.id,
      target: secondary.stat,
      application: secondary.application,
      value: secondaryValue,
      contribution: apply(
        finalStats,
        basis,
        secondary.stat,
        secondary.application,
        secondaryValue,
      ),
    });

    for (const substat of echo.substats) {
      const definition = substatIndex.get(substat.statId);
      if (!definition) throw new Error(`Unknown Echo substat ${substat.statId}.`);
      if (!definition.values.includes(substat.value as never)) {
        throw new Error(
          `Illegal Echo roll ${substat.statId}=${substat.value}.`,
        );
      }
      audit.push({
        echoIndex,
        source: "substat",
        statId: definition.statId,
        target: definition.stat,
        application: definition.application,
        value: substat.value,
        contribution: apply(
          finalStats,
          basis,
          definition.stat,
          definition.application,
          substat.value,
        ),
      });
    }
  }

  return { finalStats, audit };
}

function subtractEchoContribution(
  panelWithCurrentEchoes: FinalStats,
  panelPlusOneMoreCopy: FinalStats,
): FinalStats {
  const result = clone(panelWithCurrentEchoes);
  const scalarKeys = [
    "hp",
    "attack",
    "defense",
    "critRate",
    "critDamage",
    "energyRegen",
    "healingBonus",
    "tuneBreakBoost",
  ] as const;

  for (const key of scalarKeys) {
    result[key] -= panelPlusOneMoreCopy[key] - panelWithCurrentEchoes[key];
    if (!Number.isFinite(result[key]) || result[key] < -1e-9) {
      throw new Error(
        `Cannot remove the current Echo contribution from ${key}; panel accounting is inconsistent.`,
      );
    }
    if (result[key] < 0) result[key] = 0;
  }

  for (const key of Object.keys(result.elementalDamageBonus) as Element[]) {
    result.elementalDamageBonus[key] -=
      panelPlusOneMoreCopy.elementalDamageBonus[key] -
      panelWithCurrentEchoes.elementalDamageBonus[key];
    if (!Number.isFinite(result.elementalDamageBonus[key]) || result.elementalDamageBonus[key] < -1e-9) {
      throw new Error(
        `Cannot remove the current Echo contribution from elementalDamageBonus:${key}.`,
      );
    }
    if (result.elementalDamageBonus[key] < 0) result.elementalDamageBonus[key] = 0;
  }

  for (const key of Object.keys(result.damageTypeBonus) as DamageBonusType[]) {
    result.damageTypeBonus[key] -=
      panelPlusOneMoreCopy.damageTypeBonus[key] -
      panelWithCurrentEchoes.damageTypeBonus[key];
    if (!Number.isFinite(result.damageTypeBonus[key]) || result.damageTypeBonus[key] < -1e-9) {
      throw new Error(
        `Cannot remove the current Echo contribution from damageTypeBonus:${key}.`,
      );
    }
    if (result.damageTypeBonus[key] < 0) result.damageTypeBonus[key] = 0;
  }

  return result;
}

/**
 * Replaces a persisted Echo loadout without accumulating its permanent stats.
 * The current loadout is removed exactly once, then the next loadout is applied.
 * This keeps repeated roll edits drift-free while preserving finalStats as the
 * sole permanent-stat source consumed by combat engines.
 */
export function replaceEchoLoadoutStatsV1(
  panelWithCurrentEchoes: FinalStats,
  basis: EchoLoadoutBaseStatBasisV1,
  currentLoadout: UserEchoLoadoutV1 | undefined,
  nextLoadout: UserEchoLoadoutV1 | undefined,
): EchoLoadoutStatResolutionV1 {
  let panelWithoutEchoes = clone(panelWithCurrentEchoes);

  if (currentLoadout) {
    const duplicatedCurrent = applyEchoLoadoutStatsV1(
      panelWithCurrentEchoes,
      basis,
      currentLoadout,
    ).finalStats;
    panelWithoutEchoes = subtractEchoContribution(
      panelWithCurrentEchoes,
      duplicatedCurrent,
    );
  }

  if (!nextLoadout) {
    return { finalStats: panelWithoutEchoes, audit: [] };
  }

  return applyEchoLoadoutStatsV1(panelWithoutEchoes, basis, nextLoadout);
}
