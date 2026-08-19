import type { DamageType } from "@/domain/damage-engine";
import type { Element, FinalStats } from "@/domain/models";
import type { UserEchoLoadoutV1 } from "@/domain/user-echo-loadout";
import { reviewedEchoStatTableV1 } from "./echo-stats-v1";
import type { EchoStatApplication, EchoStatTarget } from "./schema";

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
    const damageType = target.slice("damageTypeBonus:".length) as DamageType;
    if (!(damageType in stats.damageTypeBonus)) {
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
