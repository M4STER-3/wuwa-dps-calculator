import type { RuntimeBaseStatBasis } from "./combat-context";
import type { DamageAmounts, DamageTarget } from "./damage-engine";
import type { ActionDefinitionV02 } from "./effect-models";
import { materializeWeaponForRank } from "./equipment-rank";
import type { CombatAction, FinalStats, MainEcho, Resonator, Sonata, UserBuild, Weapon } from "./models";
import { simulatePersonalCombat, type PersonalCombatResult } from "./personal-combat-simulation";
import { emptyCombatState, type CombatEvent, type CombatState } from "./state-engine";
import { buildTheoreticalRotationTimeline } from "./theoretical-rotation";
import type { TemporalRotationDefinition } from "./temporal-engine";
import type { PersonalRotationScenario, SequencePayloadOverride } from "@/data/personal-rotation-presets";

export interface TheoreticalPersonalRotationRequest {
  scenario: PersonalRotationScenario;
  resonator: Resonator;
  build: UserBuild;
  stats: FinalStats;
  target: DamageTarget & { id?: string; tuneEnemyClass?: "1C" | "3C" | "4C" };
  weapon?: Weapon;
  sonata?: Sonata;
  mainEcho?: MainEcho;
  actions: readonly CombatAction[];
  baseStatBasis?: RuntimeBaseStatBasis;
  resonanceMode?: string;
}

export interface TheoreticalPersonalRotationResult {
  scenario: PersonalRotationScenario;
  simulation: PersonalCombatResult;
}

const highestApplicableOverride = (
  overrides: readonly SequencePayloadOverride[] | undefined,
  sequence: UserBuild["sequence"],
): SequencePayloadOverride | undefined => {
  const applicable = [...(overrides ?? [])]
    .filter((override) => override.minimumSequence <= sequence)
    .sort((a, b) => a.minimumSequence - b.minimumSequence);
  return applicable[applicable.length - 1];
};

function reviewedRotationTarget(
  resonator: Resonator,
  sequence: UserBuild["sequence"],
): TemporalRotationDefinition["targetDuration"] | undefined {
  const eligible = (resonator.combat?.rotations ?? []).filter(
    (rotation) =>
      rotation.policy === "no-quickswap" &&
      rotation.sequence <= sequence &&
      typeof rotation.totalDurationSeconds.value === "number" &&
      Number.isFinite(rotation.totalDurationSeconds.value) &&
      rotation.totalDurationSeconds.value > 0,
  );
  if (!eligible.length) return undefined;
  const highestSequence = Math.max(...eligible.map((rotation) => rotation.sequence));
  const candidates = eligible.filter((rotation) => rotation.sequence === highestSequence);
  if (candidates.length !== 1) return undefined;
  const rotation = candidates[0]!;
  return {
    seconds: rotation.totalDurationSeconds.value!,
    confidence: rotation.totalDurationSeconds.confidence,
    source: [rotation.source.source, rotation.totalDurationSeconds.sourceNote]
      .filter(Boolean)
      .join(" · "),
  };
}

function compileSpecialEvents(
  scenario: PersonalRotationScenario,
  timeline: ReturnType<typeof buildTheoreticalRotationTimeline>,
  build: UserBuild,
  resonatorId: string,
  targetId: string,
): readonly CombatEvent[] {
  const events: CombatEvent[] = [];
  for (const preset of scenario.specialEvents ?? []) {
    if (preset.minimumSequence !== undefined && build.sequence < preset.minimumSequence) continue;
    if (preset.maximumSequence !== undefined && build.sequence > preset.maximumSequence) continue;
    const anchor = timeline.entries[preset.anchor.stepIndex];
    if (!anchor) throw new Error(`Rotation scenario ${scenario.id} references missing step ${preset.anchor.stepIndex} for ${preset.id}.`);
    const baseTime = preset.anchor.at === "start" ? anchor.startTimeSeconds : anchor.endTimeSeconds;
    const repeat = preset.repeat ?? 1;
    if (!Number.isInteger(repeat) || repeat <= 0) throw new Error(`Rotation special event ${preset.id} has an invalid repeat count.`);
    const override = highestApplicableOverride(preset.sequenceOverrides, build.sequence);
    for (let index = 0; index < repeat; index += 1) {
      const payload = {
        ...(preset.payload ?? {}),
        ...(preset.payloadByRepeat?.[index] ?? {}),
        ...(override?.payload ?? {}),
        ...(override?.payloadByRepeat?.[index] ?? {}),
        scenarioId: scenario.id,
      };
      events.push({
        id: `scenario:${scenario.id}:${preset.id}:${index}`,
        timestamp: baseTime + (preset.anchor.offsetSeconds ?? 0) + index * 0.000001,
        kind: preset.kind,
        ownerId: resonatorId,
        actorId: resonatorId,
        targetId,
        actionId: preset.actionId,
        occurrence: `scenario:${scenario.id}:${preset.id}:${index}`,
        external: false,
        payload,
      });
    }
  }
  return events;
}

function resourceCapForSequence(
  resource: NonNullable<Resonator["combat"]>["resources"][number],
  sequence: UserBuild["sequence"],
): number {
  const applicable = Object.entries(resource.capBySequence ?? {})
    .map(([required, cap]) => ({ required: Number(required), cap }))
    .filter((entry) => Number.isInteger(entry.required) && entry.required <= sequence && typeof entry.cap === "number")
    .sort((a, b) => b.required - a.required);
  const cap = applicable[0]?.cap ?? resource.cap;
  if (!Number.isFinite(cap) || cap <= 0) {
    throw new Error(`Resource ${resource.id} has invalid cap ${String(cap)} at S${sequence}.`);
  }
  return cap;
}

function sequenceRuntimeStates(sequence: UserBuild["sequence"]): readonly string[] {
  return [
    `sequence-${sequence}`,
    ...Array.from({ length: sequence }, (_, index) => `sequence-at-least-${index + 1}`),
  ];
}

function initialStateForScenario(
  scenario: PersonalRotationScenario,
  resonator: Resonator,
  stats: FinalStats,
  targetId: string,
  sequence: UserBuild["sequence"],
): CombatState {
  const resources = Object.fromEntries(
    (resonator.combat?.resources ?? []).map((resource) => {
      const cap = resourceCapForSequence(resource, sequence);
      const current = scenario.initialResources?.[resource.id] ?? 0;
      if (!Number.isFinite(current) || current < 0 || current > cap) {
        throw new Error(`Rotation scenario ${scenario.id} has invalid initial ${resource.id}: ${current}/${cap} at S${sequence}.`);
      }
      return [resource.id, { current, max: cap }];
    }),
  );
  return emptyCombatState({
    [resonator.id]: {
      hp: stats.hp,
      maxHp: stats.hp,
      onField: true,
      form: resonator.combat?.defaultForm,
      namedStates: ["ground", ...sequenceRuntimeStates(sequence)],
      resources,
    },
  }, [targetId]);
}

function scenarioActions(
  scenario: PersonalRotationScenario,
  actions: readonly CombatAction[],
): readonly (ActionDefinitionV02 | CombatAction)[] {
  if (!scenario.assumeLegacyRequirementsSatisfied) return actions;
  return actions.map((action) => ({
    // The catalogue keeps the verified legacy costs/gains. A theoretical scenario
    // owns their unstaged ordering, so they must not become a false PARTIAL flag.
    action: { ...action, costs: undefined, gains: undefined },
    requirements: [],
    assumeLegacyResourceStagesSatisfied: true,
  }));
}

const addAmounts = (a: DamageAmounts, b: DamageAmounts): DamageAmounts => ({
  nonCrit: a.nonCrit + b.nonCrit,
  crit: a.crit + b.crit,
  expected: a.expected + b.expected,
});

function withFixedScenarioDamage(
  simulation: PersonalCombatResult,
  events: readonly CombatEvent[],
  resonatorId: string,
): PersonalCombatResult {
  const fixed = events.flatMap((event) => {
    const amount = Number(event.payload?.fixedDamageAmount);
    return Number.isFinite(amount) && amount >= 0 ? [{ event, amount }] : [];
  });
  if (!fixed.length) return simulation;
  let fixedTotal = 0;
  const perAction = { ...simulation.perAction };
  for (const entry of fixed) {
    fixedTotal += entry.amount;
    const actionId = entry.event.actionId ?? "scenario-fixed-damage";
    const amounts = { nonCrit: entry.amount, crit: entry.amount, expected: entry.amount };
    perAction[actionId] = addAmounts(perAction[actionId] ?? { nonCrit: 0, crit: 0, expected: 0 }, amounts);
  }
  const fixedAmounts = { nonCrit: fixedTotal, crit: fixedTotal, expected: fixedTotal };
  const personalDamage = addAmounts(simulation.personalDamage, fixedAmounts);
  const duration = simulation.rotationDurationSeconds;
  const personalDps = duration > 0 ? {
    nonCrit: personalDamage.nonCrit / duration,
    crit: personalDamage.crit / duration,
    expected: personalDamage.expected / duration,
  } : simulation.personalDps;
  return {
    ...simulation,
    personalDamage,
    personalDps,
    breakdown: { ...simulation.breakdown, direct: addAmounts(simulation.breakdown.direct, fixedAmounts) },
    perAction,
    perSource: {
      ...simulation.perSource,
      [resonatorId]: addAmounts(simulation.perSource[resonatorId] ?? { nonCrit: 0, crit: 0, expected: 0 }, fixedAmounts),
    },
    coverage: {
      ...simulation.coverage,
      relevantSupported: simulation.coverage.relevantSupported + fixed.length,
      directDamageActions: simulation.coverage.directDamageActions + fixed.length,
    },
  };
}

function withScenarioContextSemantics(
  simulation: PersonalCombatResult,
): PersonalCombatResult {
  const pendingTeamContext = simulation.diagnostics.filter(
    (diagnostic) => diagnostic.code === "team-context-required",
  );
  if (!pendingTeamContext.length) return simulation;

  const diagnostics = simulation.diagnostics.map((diagnostic) =>
    diagnostic.code === "team-context-required"
      ? {
          ...diagnostic,
          relevance: "not-emitted-due-to-missing-context" as const,
        }
      : diagnostic,
  );
  const unsupportedMechanics = diagnostics.filter(
    (diagnostic) =>
      diagnostic.relevance === "relevant-unsupported" ||
      diagnostic.relevance === "not-emitted-due-to-missing-context",
  );

  return {
    ...simulation,
    diagnostics,
    unsupportedMechanics,
    coverage: {
      ...simulation.coverage,
      modeledUnused: Math.max(
        0,
        simulation.coverage.modeledUnused - pendingTeamContext.length,
      ),
      notEmittedDueToMissingContext:
        simulation.coverage.notEmittedDueToMissingContext +
        pendingTeamContext.length,
    },
    partial: true,
  };
}

export function runTheoreticalPersonalRotation(
  request: TheoreticalPersonalRotationRequest,
): TheoreticalPersonalRotationResult {
  if (request.scenario.resonatorId !== request.resonator.id) {
    throw new Error(`Rotation scenario ${request.scenario.id} belongs to ${request.scenario.resonatorId}, not ${request.resonator.id}.`);
  }
  const targetId = request.target.id ?? "training-target";
  const actions = [...request.actions, ...(request.scenario.extraActions ?? [])];
  const timeline = buildTheoreticalRotationTimeline(
    request.scenario.rotation,
    actions,
    reviewedRotationTarget(request.resonator, request.build.sequence),
  );
  const externalEvents = compileSpecialEvents(request.scenario, timeline, request.build, request.resonator.id, targetId);
  const build = { ...request.build, finalStats: request.stats };
  const rawSimulation = simulatePersonalCombat({
    resonator: request.resonator,
    build,
    timeline,
    target: { ...request.target, id: targetId },
    resonanceMode: request.scenario.resonanceMode ?? request.resonanceMode,
    baseStatBasis: request.baseStatBasis,
    actions: scenarioActions(request.scenario, actions),
    loadout: {
      weapon: materializeWeaponForRank(request.weapon, request.build.weapon.rank),
      sonata: request.sonata,
      mainEcho: request.mainEcho,
      extraEffects: request.scenario.extraEffects,
    },
    initialState: initialStateForScenario(
      request.scenario,
      request.resonator,
      request.stats,
      targetId,
      request.build.sequence,
    ),
    externalEvents,
  });
  const simulation = withScenarioContextSemantics(
    withFixedScenarioDamage(rawSimulation, externalEvents, request.resonator.id),
  );
  return {
    scenario: request.scenario,
    simulation,
  };
}
