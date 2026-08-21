import type {
  ActiveEffectInstance,
  EffectDefinition,
  EffectSourceType,
} from "@/domain/effect-models";
import { damageBonusTypes, type Element, type FinalStats } from "@/domain/models";

type DamageBonusType = (typeof damageBonusTypes)[number];

export const permanentBuildSourceKeyV1 = {
  characterPermanentNodes: (characterId: string) =>
    `character-permanent-nodes:${characterId}`,
  weaponPassive: (weaponId: string) => `weapon-passive:${weaponId}`,
  sonataBonus: (sonataSetId: string, pieces: number) =>
    `sonata-bonus:${sonataSetId}:${pieces}`,
} as const;

export type PermanentBuildStatTargetV1 =
  | "hp"
  | "attack"
  | "defense"
  | "critRate"
  | "critDamage"
  | "energyRegen"
  | "healingBonus"
  | "tuneBreakBoost"
  | `elementalDamageBonus:${Element}`
  | `damageTypeBonus:${DamageBonusType}`;

export type PermanentBuildStatModeV1 =
  | "flat"
  | "base-percent"
  | "percentage-point";

export interface PermanentBuildStatModifierV1 {
  target: PermanentBuildStatTargetV1;
  mode: PermanentBuildStatModeV1;
  value: number;
}

/**
 * Data-owned source bundle consumed by the generic Build Resolver.
 *
 * Permanent modifiers are folded into UserBuild.finalStats exactly once.
 * Runtime effects are never folded into finalStats; they are materialized as
 * ActiveEffectInstances for the Effect/Temporal engines instead.
 */
export interface BuildEffectSourceV1 {
  sourceKey: string;
  sourceId: string;
  sourceType: EffectSourceType;
  sourceLabel: string;
  /** Stable unresolved-source keys whose semantics are fully represented here. */
  coversPermanentSources?: readonly string[];
  permanentModifiers?: readonly PermanentBuildStatModifierV1[];
  runtimeEffects?: readonly EffectDefinition[];
  /** Weapon rank / sequence rank when a runtime ValueExpression uses `rank`. */
  rank?: number;
}

export interface PermanentBuildStatBasisV1 {
  hp: number;
  attack: number;
  defense: number;
}

export interface PermanentBuildEffectAuditEntryV1 {
  sourceKey: string;
  sourceId: string;
  sourceType: EffectSourceType;
  target: PermanentBuildStatTargetV1;
  mode: PermanentBuildStatModeV1;
  value: number;
  contribution: number;
}

export interface AppliedPermanentBuildEffectsV1 {
  statSheet: FinalStats;
  audit: readonly PermanentBuildEffectAuditEntryV1[];
}

function fail(message: string): never {
  throw new Error(`Build effects V1 rejected input: ${message}`);
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) fail(`${label} must be finite`);
  return value;
}

function cloneFinalStats(stats: FinalStats): FinalStats {
  return {
    ...stats,
    elementalDamageBonus: { ...stats.elementalDamageBonus },
    damageTypeBonus: { ...stats.damageTypeBonus },
  };
}

function addPercentagePoint(
  stats: FinalStats,
  target: PermanentBuildStatTargetV1,
  value: number,
): void {
  if (
    target === "critRate" ||
    target === "critDamage" ||
    target === "energyRegen" ||
    target === "healingBonus" ||
    target === "tuneBreakBoost"
  ) {
    stats[target] += value;
    return;
  }

  if (target.startsWith("elementalDamageBonus:")) {
    const element = target.slice("elementalDamageBonus:".length) as Element;
    if (!(element in stats.elementalDamageBonus)) {
      fail(`unknown elemental damage target ${target}`);
    }
    stats.elementalDamageBonus[element] += value;
    return;
  }

  if (target.startsWith("damageTypeBonus:")) {
    const damageType = target.slice("damageTypeBonus:".length) as DamageBonusType;
    if (!damageBonusTypes.includes(damageType)) {
      fail(`unknown damage type target ${target}`);
    }
    stats.damageTypeBonus[damageType] += value;
    return;
  }

  fail(`${target} cannot use percentage-point mode`);
}

export function applyPermanentBuildEffectsV1(
  statSheet: FinalStats,
  basis: PermanentBuildStatBasisV1,
  sources: readonly BuildEffectSourceV1[],
): AppliedPermanentBuildEffectsV1 {
  const result = cloneFinalStats(statSheet);
  const audit: PermanentBuildEffectAuditEntryV1[] = [];
  const sourceKeys = new Set<string>();

  for (const source of sources) {
    if (!source.sourceKey || sourceKeys.has(source.sourceKey)) {
      fail(`sourceKey ${JSON.stringify(source.sourceKey)} must be non-empty and unique`);
    }
    sourceKeys.add(source.sourceKey);

    for (const [index, modifier] of (source.permanentModifiers ?? []).entries()) {
      const value = finite(modifier.value, `${source.sourceKey}.permanentModifiers[${index}].value`);
      let contribution = value;

      if (modifier.mode === "flat") {
        if (
          modifier.target !== "hp" &&
          modifier.target !== "attack" &&
          modifier.target !== "defense"
        ) {
          fail(`${modifier.target} cannot use flat mode`);
        }
        result[modifier.target] += value;
      } else if (modifier.mode === "base-percent") {
        if (
          modifier.target !== "hp" &&
          modifier.target !== "attack" &&
          modifier.target !== "defense"
        ) {
          fail(`${modifier.target} cannot use base-percent mode`);
        }
        contribution = finite(
          basis[modifier.target] * value / 100,
          `${source.sourceKey}.${modifier.target} contribution`,
        );
        result[modifier.target] += contribution;
      } else {
        addPercentagePoint(result, modifier.target, value);
      }

      audit.push({
        sourceKey: source.sourceKey,
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        target: modifier.target,
        mode: modifier.mode,
        value,
        contribution,
      });
    }
  }

  for (const [key, value] of Object.entries({
    hp: result.hp,
    attack: result.attack,
    defense: result.defense,
    critRate: result.critRate,
    critDamage: result.critDamage,
    energyRegen: result.energyRegen,
    healingBonus: result.healingBonus,
    tuneBreakBoost: result.tuneBreakBoost,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      fail(`resolved ${key} must remain finite and non-negative`);
    }
  }

  return { statSheet: result, audit };
}

export function materializeBuildRuntimeEffectsV1(
  ownerId: string,
  sources: readonly BuildEffectSourceV1[],
): readonly ActiveEffectInstance[] {
  const instances: ActiveEffectInstance[] = [];
  const instanceIds = new Set<string>();

  for (const source of sources) {
    for (const definition of source.runtimeEffects ?? []) {
      if (definition.source.id !== source.sourceId) {
        fail(
          `${source.sourceKey} runtime effect ${definition.id} source id ${definition.source.id} does not match ${source.sourceId}`,
        );
      }
      if (definition.source.type !== source.sourceType) {
        fail(
          `${source.sourceKey} runtime effect ${definition.id} source type ${definition.source.type} does not match ${source.sourceType}`,
        );
      }
      const id = `build:${source.sourceKey}:${definition.id}`;
      if (instanceIds.has(id)) fail(`duplicate runtime effect instance ${id}`);
      instanceIds.add(id);
      instances.push({
        id,
        definition,
        ownerId,
        sourceId: source.sourceId,
        ...(source.rank !== undefined ? { rank: source.rank } : {}),
      });
    }
  }

  return instances;
}

export function coveredPermanentSourceKeysV1(
  sources: readonly BuildEffectSourceV1[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const source of sources) {
    for (const key of source.coversPermanentSources ?? []) {
      if (!key) fail(`${source.sourceKey} contains an empty permanent-source coverage key`);
      keys.add(key);
    }
  }
  return keys;
}
