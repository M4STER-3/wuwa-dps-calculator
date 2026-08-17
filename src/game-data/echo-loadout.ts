import type { Element } from "@/domain/models";
import type {
  EchoCost,
  EchoMainStatDefinition,
  EchoStatApplication,
  EchoStatRollDefinition,
  EchoStatTableCatalog,
  EchoStatTarget,
} from "./schema";
import { reviewedEchoStatTableV1 } from "./echo-stats-v1";

export interface EquippedEchoSubstatV1 {
  statId: string;
  value: number;
}

export interface EquippedEchoV1 {
  echoId: string;
  sonataSetId: string;
  rarity: 5;
  level: 25;
  primaryMainStatId: string;
  substats: readonly EquippedEchoSubstatV1[];
}

export interface EchoLoadoutV1 {
  echoes: readonly EquippedEchoV1[];
  /** Canonical Echo id occupying the active Echo Skill slot. */
  mainEchoId?: string;
}

/**
 * Minimum reviewed catalog surface required to validate and resolve an Echo loadout.
 * The promoted GameDatabase and the browser-safe lightweight projection both satisfy
 * this contract without changing resolver behavior or duplicating gameplay rules.
 */
export interface EchoLoadoutCatalogV1 {
  readonly echoes: readonly {
    readonly id: string;
    readonly cost: EchoCost;
    readonly sonataSetIds: readonly string[];
  }[];
  readonly sonataSets: readonly {
    readonly id: string;
  }[];
}

export interface EchoPermanentStatContributions {
  flat: {
    hp: number;
    attack: number;
    defense: number;
  };
  basePercent: {
    hp: number;
    attack: number;
    defense: number;
  };
  percentagePoints: {
    critRate: number;
    critDamage: number;
    energyRegen: number;
    healingBonus: number;
    elementalDamageBonus: Record<Element, number>;
    damageTypeBonus: {
      basicAttack: number;
      heavyAttack: number;
      resonanceSkill: number;
      resonanceLiberation: number;
    };
  };
}

export interface ResolvedEchoLoadoutV1 {
  totalCost: number;
  mainEchoId?: string;
  sonataPieceCounts: Readonly<Record<string, number>>;
  contributions: EchoPermanentStatContributions;
  echoes: readonly {
    echoId: string;
    sonataSetId: string;
    cost: EchoCost;
    primaryMainStatId: string;
  }[];
}

function fail(message: string): never {
  throw new Error(`Echo loadout V1 rejected input: ${message}`);
}

function finite(value: number, label: string) {
  if (!Number.isFinite(value)) fail(`${label} must be finite`);
  return value;
}

function blankContributions(): EchoPermanentStatContributions {
  return {
    flat: { hp: 0, attack: 0, defense: 0 },
    basePercent: { hp: 0, attack: 0, defense: 0 },
    percentagePoints: {
      critRate: 0,
      critDamage: 0,
      energyRegen: 0,
      healingBonus: 0,
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
      },
    },
  };
}

function addBaseStat(
  target: EchoStatTarget,
  application: EchoStatApplication,
  value: number,
  output: EchoPermanentStatContributions,
) {
  if (target !== "hp" && target !== "attack" && target !== "defense") {
    fail(`${target} cannot use ${application}`);
  }
  if (application === "flat") output.flat[target] += value;
  else if (application === "base-percent") output.basePercent[target] += value;
  else fail(`${target} cannot use percentage-point application`);
}

function addPercentagePoint(
  target: EchoStatTarget,
  value: number,
  output: EchoPermanentStatContributions,
) {
  if (target === "critRate" || target === "critDamage" || target === "energyRegen" || target === "healingBonus") {
    output.percentagePoints[target] += value;
    return;
  }
  if (target.startsWith("elementalDamageBonus:")) {
    const element = target.slice("elementalDamageBonus:".length) as Element;
    if (!(element in output.percentagePoints.elementalDamageBonus)) fail(`unknown elemental target ${target}`);
    output.percentagePoints.elementalDamageBonus[element] += value;
    return;
  }
  if (target.startsWith("damageTypeBonus:")) {
    const damageType = target.slice("damageTypeBonus:".length) as keyof EchoPermanentStatContributions["percentagePoints"]["damageTypeBonus"];
    if (!(damageType in output.percentagePoints.damageTypeBonus)) fail(`unknown damage-type target ${target}`);
    output.percentagePoints.damageTypeBonus[damageType] += value;
    return;
  }
  fail(`${target} cannot use percentage-point application`);
}

function applyStat(
  target: EchoStatTarget,
  application: EchoStatApplication,
  rawValue: number,
  output: EchoPermanentStatContributions,
) {
  const value = finite(rawValue, target);
  if (application === "flat" || application === "base-percent") {
    addBaseStat(target, application, value, output);
    return;
  }
  addPercentagePoint(target, value, output);
}

function exactMainStatValue(definition: EchoMainStatDefinition, level: number) {
  if (definition.progression.interpolation !== "none") fail(`${definition.id} allows unreviewed interpolation`);
  const matches = definition.progression.points.filter((point) => point.level === level);
  if (matches.length !== 1) fail(`${definition.id} has no single exact value at level ${level}`);
  return finite(matches[0]!.value, `${definition.id} level ${level}`);
}

function indexSubstats(table: EchoStatTableCatalog) {
  const index = new Map<string, EchoStatRollDefinition>();
  for (const definition of table.substatRolls) {
    if (index.has(definition.statId)) fail(`Echo stat table duplicates substat ${definition.statId}`);
    index.set(definition.statId, definition);
  }
  return index;
}

export function resolveEchoLoadoutV1(
  database: EchoLoadoutCatalogV1,
  loadout: EchoLoadoutV1,
  table: EchoStatTableCatalog = reviewedEchoStatTableV1,
): ResolvedEchoLoadoutV1 {
  if (!Array.isArray(loadout.echoes) || loadout.echoes.length > 5) {
    fail("loadout must contain at most five Echoes");
  }
  if (table.supportedRarity !== 5) fail("V1 requires the reviewed five-star stat table");

  const echoesById = new Map(database.echoes.map((echo) => [echo.id, echo]));
  if (echoesById.size !== database.echoes.length) fail("database contains duplicate Echo ids");
  const sonataIds = new Set(database.sonataSets.map((set) => set.id));
  if (sonataIds.size !== database.sonataSets.length) fail("database contains duplicate Sonata ids");
  const substatsById = indexSubstats(table);
  const seenEchoIds = new Set<string>();
  const sonataPieceCounts: Record<string, number> = Object.create(null) as Record<string, number>;
  const contributions = blankContributions();
  const resolvedEchoes: ResolvedEchoLoadoutV1["echoes"][number][] = [];
  let totalCost = 0;

  for (const [index, equipped] of loadout.echoes.entries()) {
    if (typeof equipped.echoId !== "string" || equipped.echoId.length === 0) fail(`echoes[${index}].echoId is invalid`);
    if (seenEchoIds.has(equipped.echoId)) {
      fail(`echoes[${index}] duplicates Echo ${equipped.echoId}; V1 requires unique Echo types so Sonata counting is unambiguous`);
    }
    seenEchoIds.add(equipped.echoId);

    const echo = echoesById.get(equipped.echoId);
    if (!echo) fail(`echoes[${index}] references unknown Echo ${equipped.echoId}`);
    if (equipped.rarity !== table.supportedRarity) fail(`echoes[${index}] uses unsupported rarity ${equipped.rarity}`);
    if (equipped.level !== 25) fail(`echoes[${index}] uses unsupported level ${equipped.level}`);
    if (!sonataIds.has(equipped.sonataSetId) || !echo.sonataSetIds.includes(equipped.sonataSetId)) {
      fail(`echoes[${index}] selects Sonata ${equipped.sonataSetId} that ${echo.id} cannot have`);
    }

    const primaryDefinitions = table.primaryMainStatsByCost[echo.cost];
    const primary = primaryDefinitions.find((definition) => definition.id === equipped.primaryMainStatId);
    if (!primary) fail(`echoes[${index}] selects invalid ${echo.cost}-cost main stat ${equipped.primaryMainStatId}`);
    applyStat(primary.stat, primary.application, exactMainStatValue(primary, equipped.level), contributions);

    const fixedSecondary = table.fixedSecondaryMainStatByCost[echo.cost];
    applyStat(
      fixedSecondary.stat,
      fixedSecondary.application,
      exactMainStatValue(fixedSecondary, equipped.level),
      contributions,
    );

    if (!Array.isArray(equipped.substats) || equipped.substats.length > 5) {
      fail(`echoes[${index}] must have at most five substats`);
    }
    const seenSubstats = new Set<string>();
    for (const [subIndex, selected] of equipped.substats.entries()) {
      if (seenSubstats.has(selected.statId)) fail(`echoes[${index}] duplicates substat ${selected.statId}`);
      seenSubstats.add(selected.statId);
      const definition = substatsById.get(selected.statId);
      if (!definition) fail(`echoes[${index}].substats[${subIndex}] references unknown stat ${selected.statId}`);
      if (!definition.values.includes(selected.value)) {
        fail(`echoes[${index}].substats[${subIndex}] uses impossible roll ${selected.value} for ${selected.statId}`);
      }
      applyStat(definition.stat, definition.application, selected.value, contributions);
    }

    totalCost += echo.cost;
    if (totalCost > 12) fail(`Echo cost exceeds 12 (${totalCost})`);
    sonataPieceCounts[equipped.sonataSetId] = (sonataPieceCounts[equipped.sonataSetId] ?? 0) + 1;
    resolvedEchoes.push({
      echoId: echo.id,
      sonataSetId: equipped.sonataSetId,
      cost: echo.cost,
      primaryMainStatId: primary.id,
    });
  }

  if (loadout.mainEchoId !== undefined && !seenEchoIds.has(loadout.mainEchoId)) {
    fail(`mainEchoId ${loadout.mainEchoId} is not equipped`);
  }

  return {
    totalCost,
    ...(loadout.mainEchoId !== undefined ? { mainEchoId: loadout.mainEchoId } : {}),
    sonataPieceCounts: Object.freeze({ ...sonataPieceCounts }),
    contributions,
    echoes: resolvedEchoes,
  };
}
