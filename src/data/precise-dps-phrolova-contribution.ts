import type { DamageAmounts, DamageTarget } from "@/domain/damage-engine";
import { materializeWeaponForRank } from "@/domain/equipment-rank";
import type { EffectDefinition } from "@/domain/effect-models";
import type { FinalStats, Resonator, UserBuild, Weapon } from "@/domain/models";
import {
  simulatePersonalCombat,
  type PersonalCombatResult,
} from "@/domain/personal-combat-simulation";
import {
  emptyCombatState,
  type ActiveRuntimeEffect,
  type CombatEvent,
  type CombatState,
} from "@/domain/state-engine";
import type { TemporalTimeline } from "@/domain/temporal-engine";
import { buildTheoreticalRotationTimeline } from "@/domain/theoretical-rotation";
import type { PersonalRotationScenario } from "./personal-rotation-presets";
import {
  PHROLOVA_AFTERSOUND_OVERFLOW_CRIT_CAP,
  PHROLOVA_AFTERSOUND_OVERFLOW_EFFECT_ID,
} from "./precise-dps-phrolova-aftersound";
import { PHROLOVA } from "./precise-dps-phrolova";
import {
  buildPhrolovaMaestroSchedule,
  PHROLOVA_MAESTRO_DURATION_SECONDS,
  phrolovaMaestroRuntimeEffect,
  type PhrolovaMaestroSchedule,
  type PhrolovaPreciseScenarioId,
  type PhrolovaTeamEchoTrigger,
} from "./precise-dps-phrolova-team";

export const PHROLOVA_EXACT_CYCLE_SECONDS = 25;
const REFERENCE_ECHO_EVENT_ID = "phrolova-reference-main-echo-cast";
const REFERENCE_ECHO_LABEL = "Reference Main Echo cast · build-owned damage excluded";
const TEAM_PENDING_EFFECT_ID = "precise-phrolova-team-cycle-pending";

export interface PhrolovaContributionCycleInput {
  scenario: PersonalRotationScenario;
  resonator: Resonator;
  build: UserBuild;
  stats: FinalStats;
  target: DamageTarget & { id?: string; tuneEnemyClass?: "1C" | "3C" | "4C" };
  weapon?: Weapon;
  baseStatBasis?: { attack?: number; hp?: number; defense?: number };
  teamEchoTriggers?: readonly PhrolovaTeamEchoTrigger[];
  /** Exact carried value for loop scenarios. The opener uses Octet's battle bootstrap when omitted. */
  initialAftersound?: number;
  /** Exact persistent CRIT-DMG overflow carried from an earlier cycle. */
  initialAftersoundOverflowCrit?: number;
}

export interface PhrolovaContributionCycleResult {
  cycleDurationSeconds: number;
  onFieldDurationSeconds: number;
  offFieldDurationSeconds: number;
  maestroScheduledDurationSeconds: number;
  onField: PersonalCombatResult;
  offField: PersonalCombatResult;
  maestroSchedule: PhrolovaMaestroSchedule;
  totalDamage: DamageAmounts;
  contributionDps: DamageAmounts;
  finalAftersound: number;
  finalAftersoundOverflowCrit: number;
  partial: boolean;
  diagnostics: readonly string[];
}

const zero = (): DamageAmounts => ({ nonCrit: 0, crit: 0, expected: 0 });
const add = (a: DamageAmounts, b: DamageAmounts): DamageAmounts => ({
  nonCrit: a.nonCrit + b.nonCrit,
  crit: a.crit + b.crit,
  expected: a.expected + b.expected,
});
const divide = (value: DamageAmounts, seconds: number): DamageAmounts =>
  seconds > 0
    ? {
        nonCrit: value.nonCrit / seconds,
        crit: value.crit / seconds,
        expected: value.expected / seconds,
      }
    : zero();

function sequenceStates(sequence: UserBuild["sequence"]): readonly string[] {
  return [
    "ground",
    `sequence-${sequence}`,
    ...Array.from({ length: sequence }, (_, index) => `sequence-at-least-${index + 1}`),
  ];
}

function withoutResolvedTeamPending(resonator: Resonator): Resonator {
  if (!resonator.combat) return resonator;
  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      effects: resonator.combat.effects.filter(
        (effect) => effect.structuredEffect?.id !== TEAM_PENDING_EFFECT_ID,
      ),
    },
  };
}

function withOverflowCapacity(resonator: Resonator, capacity: number): Resonator {
  if (!resonator.combat) return resonator;
  const safeCapacity = Math.max(0, Math.min(PHROLOVA_AFTERSOUND_OVERFLOW_CRIT_CAP, capacity));
  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      effects: resonator.combat.effects.map((effect) => {
        const definition = effect.structuredEffect;
        if (definition?.id !== PHROLOVA_AFTERSOUND_OVERFLOW_EFFECT_ID) return effect;
        const structuredEffect: EffectDefinition = {
          ...definition,
          lifecycle: definition.lifecycle?.stacks
            ? {
                ...definition.lifecycle,
                stacks: { ...definition.lifecycle.stacks, max: safeCapacity },
              }
            : definition.lifecycle,
          rules: definition.rules.map((rule) => ({
            ...rule,
            modifiers: rule.modifiers.map((modifier) =>
              modifier.kind === "crit-damage-bonus" && modifier.valuePerStack !== undefined
                ? { ...modifier, maxStacks: safeCapacity }
                : modifier,
            ),
          })),
        };
        return { ...effect, structuredEffect };
      }),
    },
  };
}

function scenarioWithCarriedAftersound(
  scenario: PersonalRotationScenario,
  value: number | undefined,
): PersonalRotationScenario {
  if (value === undefined) return scenario;
  return {
    ...scenario,
    initialResources: { ...(scenario.initialResources ?? {}), aftersound: value },
  };
}

function scenarioWithReferenceEchoTime(
  scenario: PersonalRotationScenario,
): PersonalRotationScenario {
  let forteCount = 0;
  const steps = scenario.rotation.steps.flatMap((step) => {
    if (
      step.actionId !== PHROLOVA.movement &&
      step.actionId !== PHROLOVA.murmurs
    ) {
      return [step];
    }
    forteCount += step.repeat ?? 1;
    if (forteCount !== 2) return [step];
    return [
      step,
      { label: REFERENCE_ECHO_LABEL, profileId: "echo-skill" as const },
    ];
  });
  if (forteCount < 2) return scenario;
  return {
    ...scenario,
    rotation: { ...scenario.rotation, steps },
  };
}

function timeOnlyTimeline(source: TemporalTimeline): TemporalTimeline {
  return {
    ...source,
    entries: [],
  };
}

function aggregateActionEvents(
  timeline: TemporalTimeline,
  ownerId: string,
  targetId: string,
): CombatEvent[] {
  const events: CombatEvent[] = [];
  for (const [index, entry] of timeline.entries.entries()) {
    const occurrence = `phrolova-aggregate:${index}`;
    events.push({
      id: `${occurrence}:rotation`,
      timestamp: entry.startTimeSeconds,
      kind: "rotation-step-start",
      ownerId,
      actorId: ownerId,
      targetId,
      actionId: entry.actionId,
      occurrence,
      external: false,
    });
    events.push({
      id: `${occurrence}:start`,
      timestamp: entry.startTimeSeconds,
      kind: "action-start",
      ownerId,
      actorId: ownerId,
      targetId,
      actionId: entry.actionId,
      occurrence,
      external: false,
    });
    if (entry.actionId) {
      const hitTime = Math.max(
        entry.startTimeSeconds,
        entry.endTimeSeconds - 0.000001,
      );
      events.push({
        id: `${occurrence}:aggregate-hit`,
        timestamp: hitTime,
        kind: "action-hit",
        ownerId,
        actorId: ownerId,
        targetId,
        actionId: entry.actionId,
        occurrence: `${occurrence}:hit`,
        external: false,
        payload: {
          damageOwnerId: ownerId,
          scalingOwnerId: ownerId,
          attribution: "direct",
          aggregateTheoreticalHit: true,
        },
      });
    }
    events.push({
      id: `${occurrence}:end`,
      timestamp: entry.endTimeSeconds,
      kind: "action-end",
      ownerId,
      actorId: ownerId,
      targetId,
      actionId: entry.actionId,
      occurrence,
      external: false,
    });
  }
  return events;
}

function referenceEchoBridgeEffect(): EffectDefinition {
  return {
    id: "scenario-phrolova-reference-echo-bridge",
    label: "Phrolova reference Main Echo cast bridge",
    source: { id: "scenario-phrolova", type: "system", label: "Phrolova precise contribution cycle" },
    target: "self",
    rules: [],
    triggers: [
      {
        id: "phrolova-reference-echo-activates-runtime-windows",
        event: "custom",
        predicates: [
          { kind: "identity", field: "actionId", anyOf: [REFERENCE_ECHO_EVENT_ID] },
        ],
        operations: [
          { kind: "activate-effect", effectId: "precise-phrolova-s4-self" },
          { kind: "activate-effect", effectId: "precise-lethean-window" },
        ],
        maxTriggers: 1,
        triggerCountScope: "owner",
      },
    ],
  };
}

function referenceEchoEvent(
  timeline: TemporalTimeline,
  ownerId: string,
  targetId: string,
): CombatEvent | undefined {
  const echo = timeline.entries.find((entry) => entry.label === REFERENCE_ECHO_LABEL);
  if (!echo) return undefined;
  return {
    id: "phrolova-reference-main-echo",
    timestamp: Math.max(echo.startTimeSeconds, echo.endTimeSeconds - 0.000001),
    kind: "custom",
    ownerId,
    actorId: ownerId,
    targetId,
    actionId: REFERENCE_ECHO_EVENT_ID,
    occurrence: "phrolova-reference-main-echo",
    external: false,
    payload: { buildOwnedEchoDamageExcluded: true },
  };
}

function initialOnFieldState(
  resonator: Resonator,
  stats: FinalStats,
  targetId: string,
  sequence: UserBuild["sequence"],
  initialResources: Readonly<Record<string, number>> | undefined,
): CombatState {
  return emptyCombatState(
    {
      [resonator.id]: {
        hp: stats.hp,
        maxHp: stats.hp,
        onField: true,
        form: resonator.combat?.defaultForm,
        namedStates: sequenceStates(sequence),
        resources: Object.fromEntries(
          (resonator.combat?.resources ?? []).map((resource) => [
            resource.id,
            {
              current: Math.min(resource.cap, Math.max(0, initialResources?.[resource.id] ?? 0)),
              max: resource.cap,
            },
          ]),
        ),
      },
    },
    [targetId],
  );
}

function generatedOverflow(state: CombatState): number {
  return Math.max(
    0,
    state.activeEffects.find(
      (effect) => effect.definition.id === PHROLOVA_AFTERSOUND_OVERFLOW_EFFECT_ID,
    )?.stacks ?? 0,
  );
}

function normalizeCarriedEffect(
  effect: ActiveRuntimeEffect,
  sourceTime: number,
): ActiveRuntimeEffect | undefined {
  if (effect.definition.activationPolicy === "initially-active") return undefined;
  if (effect.definition.id === PHROLOVA_AFTERSOUND_OVERFLOW_EFFECT_ID) return undefined;
  if (effect.expiresAt !== undefined && effect.expiresAt <= sourceTime) return undefined;
  const expiresAt =
    effect.expiresAt === undefined ? undefined : effect.expiresAt - sourceTime;
  const stackExpirations = effect.stackExpirations
    ?.filter((value) => value > sourceTime)
    .map((value) => value - sourceTime);
  return {
    ...effect,
    id: `carried:${effect.id}`,
    activatedAt: Math.max(0, effect.activatedAt - sourceTime),
    expiresAt,
    stackExpirations,
  };
}

function initialOffFieldState(
  onField: PersonalCombatResult,
  resonator: Resonator,
  targetId: string,
): CombatState {
  const source = onField.finalState;
  const actor = source.actors[resonator.id];
  if (!actor) throw new Error("Phrolova contribution cycle lost the Phrolova actor state.");
  const carriedEffects = source.activeEffects.flatMap((effect) => {
    const carried = normalizeCarriedEffect(effect, source.time);
    return carried ? [carried] : [];
  });
  const maestro: ActiveRuntimeEffect = {
    id: `phrolova-maestro:${resonator.id}:0`,
    definition: phrolovaMaestroRuntimeEffect,
    ownerId: resonator.id,
    activatedAt: 0,
    startTimeSeconds: 0,
    endTimeSeconds: PHROLOVA_MAESTRO_DURATION_SECONDS,
    expiresAt: PHROLOVA_MAESTRO_DURATION_SECONDS,
  };
  const targets = Object.fromEntries(
    Object.entries(source.targets).map(([id, target]) => [
      id,
      {
        ...target,
        statuses: Object.fromEntries(
          Object.entries(target.statuses).flatMap(([statusId, status]) => {
            if (status.expiresAt !== undefined && status.expiresAt <= source.time) return [];
            return [[
              statusId,
              {
                ...status,
                expiresAt:
                  status.expiresAt === undefined
                    ? undefined
                    : status.expiresAt - source.time,
              },
            ]];
          }),
        ),
      },
    ]),
  );
  const base = emptyCombatState(
    {
      [resonator.id]: {
        ...actor,
        onField: false,
        form: "Maestro",
        resources: actor.resources,
      },
    },
    [targetId],
  );
  return {
    ...base,
    targets,
    activeEffects: [...carriedEffects, maestro],
  };
}

function offFieldTimeline(durationSeconds: number): TemporalTimeline {
  return {
    rotationId: "phrolova-maestro-offfield",
    name: "Phrolova · Hecate off-field remainder",
    policy: "no-quickswap",
    targetDurationSeconds: durationSeconds,
    targetConfidence: "exact-cycle-remainder",
    targetSource: "25s Compose cycle minus WUWA LAB theoretical on-field route",
    rawDurationSeconds: durationSeconds,
    measuredDurationSeconds: 0,
    estimatedDurationSeconds: durationSeconds,
    calibrationFactor: null,
    finalDurationSeconds: durationSeconds,
    confidence: "estimated-calibrated",
    entries: [],
    diagnostics: [],
  };
}

function offFieldActionEvents(
  schedule: PhrolovaMaestroSchedule,
  ownerId: string,
  targetId: string,
  fullOffFieldDurationSeconds: number,
): CombatEvent[] {
  const events = schedule.events.map((entry, index): CombatEvent => ({
    id: `phrolova-maestro:${index}`,
    timestamp: entry.timeSeconds,
    kind: "action-hit",
    ownerId,
    actorId: ownerId,
    triggeringActorId: entry.action.triggeringActorId,
    targetId,
    actionId: entry.action.actionId,
    occurrence: `phrolova-maestro:${index}`,
    external: false,
    payload: {
      damageOwnerId: ownerId,
      scalingOwnerId: ownerId,
      attribution: "summon",
      sourceEffectId: "precise-phrolova-maestro-runtime",
      theoreticalOffFieldTimestamp: true,
      hecateEventKind: entry.kind,
      volatileNote: entry.note,
      ...(entry.echoName ? { echoName: entry.echoName } : {}),
    },
  }));
  events.push({
    id: "phrolova-maestro-window-end",
    timestamp: fullOffFieldDurationSeconds,
    kind: "custom",
    ownerId,
    actorId: ownerId,
    targetId,
    occurrence: "phrolova-maestro-window-end",
    external: true,
    payload: { noDamage: true },
  });
  return events;
}

export function runPhrolovaContributionCycle(
  input: PhrolovaContributionCycleInput,
): PhrolovaContributionCycleResult {
  if (input.resonator.id !== "phrolova" || input.scenario.resonatorId !== "phrolova") {
    throw new Error("Phrolova contribution cycle requires the Phrolova resonator and scenario.");
  }
  if (!input.resonator.combat) throw new Error("Phrolova precise combat data is missing.");
  const scenarioId = input.scenario.id as PhrolovaPreciseScenarioId;
  if (![
    "phrolova-opener-boss",
    "phrolova-loop-boss",
    "phrolova-opener-aoe",
    "phrolova-loop-aoe",
  ].includes(scenarioId)) {
    throw new Error(`Unsupported Phrolova precise scenario ${input.scenario.id}.`);
  }

  const targetId = input.target.id ?? "training-target";
  const carriedOverflow = Math.max(
    0,
    Math.min(
      PHROLOVA_AFTERSOUND_OVERFLOW_CRIT_CAP,
      input.initialAftersoundOverflowCrit ?? 0,
    ),
  );
  const cycleStats: FinalStats = {
    ...input.stats,
    critDamage: input.stats.critDamage + carriedOverflow,
    elementalDamageBonus: { ...input.stats.elementalDamageBonus },
    damageTypeBonus: { ...input.stats.damageTypeBonus },
  };
  const teamResolved = withoutResolvedTeamPending(input.resonator);
  const onFieldResonator = withOverflowCapacity(
    teamResolved,
    PHROLOVA_AFTERSOUND_OVERFLOW_CRIT_CAP - carriedOverflow,
  );
  const scenario = scenarioWithReferenceEchoTime(
    scenarioWithCarriedAftersound(input.scenario, input.initialAftersound),
  );
  const theoretical = buildTheoreticalRotationTimeline(
    scenario.rotation,
    onFieldResonator.combat!.actions,
  );
  const actionEvents = aggregateActionEvents(theoretical, onFieldResonator.id, targetId);
  const echoEvent = referenceEchoEvent(theoretical, onFieldResonator.id, targetId);
  const onFieldEvents = echoEvent ? [...actionEvents, echoEvent] : actionEvents;
  const build = { ...input.build, finalStats: cycleStats };
  const onField = simulatePersonalCombat({
    resonator: onFieldResonator,
    build,
    timeline: timeOnlyTimeline(theoretical),
    target: { ...input.target, id: targetId },
    actions: onFieldResonator.combat!.actions,
    baseStatBasis: input.baseStatBasis,
    loadout: {
      weapon: materializeWeaponForRank(input.weapon, input.build.weapon.rank),
      extraEffects: [referenceEchoBridgeEffect()],
    },
    initialState: initialOnFieldState(
      onFieldResonator,
      cycleStats,
      targetId,
      input.build.sequence,
      scenario.initialResources,
    ),
    externalEvents: onFieldEvents,
  });

  const diagnostics: string[] = [];
  const isLoop = scenarioId.includes("loop");
  if (isLoop && input.initialAftersound === undefined) {
    diagnostics.push(
      "Exact loop Aftersound carry is Team Cycle-owned; provide initialAftersound from the previous cycle for a complete loop result.",
    );
  }
  if (input.teamEchoTriggers === undefined) {
    diagnostics.push(
      "Exact teammate Echo casts are Team Cycle-owned; provide teamEchoTriggers for a complete Hecate contribution result.",
    );
  }
  if (!echoEvent) {
    diagnostics.push("Reference Main Echo timing could not be anchored after the second enhanced Forte.");
  }

  const onFieldDurationSeconds = theoretical.finalDurationSeconds;
  const offFieldDurationSeconds = Math.max(0, PHROLOVA_EXACT_CYCLE_SECONDS - onFieldDurationSeconds);
  if (onFieldDurationSeconds >= PHROLOVA_EXACT_CYCLE_SECONDS) {
    diagnostics.push(
      `The theoretical on-field route is ${onFieldDurationSeconds.toFixed(3)}s, leaving no valid remainder inside the exact 25s Compose cycle.`,
    );
  }
  const maestroScheduledDurationSeconds = Math.min(
    PHROLOVA_MAESTRO_DURATION_SECONDS,
    offFieldDurationSeconds,
  );
  const generatedOnFieldOverflow = generatedOverflow(onField.finalState);
  const overflowAfterOnField = Math.min(
    PHROLOVA_AFTERSOUND_OVERFLOW_CRIT_CAP,
    carriedOverflow + generatedOnFieldOverflow,
  );
  const offFieldStats: FinalStats = {
    ...input.stats,
    critDamage: input.stats.critDamage + overflowAfterOnField,
    elementalDamageBonus: { ...input.stats.elementalDamageBonus },
    damageTypeBonus: { ...input.stats.damageTypeBonus },
  };
  const offFieldResonator = withOverflowCapacity(
    teamResolved,
    PHROLOVA_AFTERSOUND_OVERFLOW_CRIT_CAP - overflowAfterOnField,
  );
  const maestroSchedule = buildPhrolovaMaestroSchedule({
    scenarioId,
    sequence: input.build.sequence,
    phrolovaActorId: offFieldResonator.id,
    targetId,
    durationSeconds: maestroScheduledDurationSeconds,
    teamEchoTriggers: input.teamEchoTriggers ?? [],
  });
  const offField = simulatePersonalCombat({
    resonator: offFieldResonator,
    build: { ...input.build, finalStats: offFieldStats },
    timeline: offFieldTimeline(offFieldDurationSeconds),
    target: { ...input.target, id: targetId },
    actions: offFieldResonator.combat!.actions,
    baseStatBasis: input.baseStatBasis,
    loadout: {
      weapon: materializeWeaponForRank(input.weapon, input.build.weapon.rank),
    },
    initialState: initialOffFieldState(onField, offFieldResonator, targetId),
    externalEvents: offFieldActionEvents(
      maestroSchedule,
      offFieldResonator.id,
      targetId,
      offFieldDurationSeconds,
    ),
  });

  const generatedOffFieldOverflow = generatedOverflow(offField.finalState);
  const finalAftersoundOverflowCrit = Math.min(
    PHROLOVA_AFTERSOUND_OVERFLOW_CRIT_CAP,
    overflowAfterOnField + generatedOffFieldOverflow,
  );
  const finalAftersound =
    offField.finalState.actors[offFieldResonator.id]?.resources.aftersound?.current ??
    onField.finalState.actors[onFieldResonator.id]?.resources.aftersound?.current ??
    0;
  const totalDamage = add(onField.personalDamage, offField.personalDamage);
  const partial =
    onField.partial ||
    offField.partial ||
    diagnostics.length > 0 ||
    offFieldDurationSeconds <= 0;

  return {
    cycleDurationSeconds: PHROLOVA_EXACT_CYCLE_SECONDS,
    onFieldDurationSeconds,
    offFieldDurationSeconds,
    maestroScheduledDurationSeconds,
    onField,
    offField,
    maestroSchedule,
    totalDamage,
    contributionDps: divide(totalDamage, PHROLOVA_EXACT_CYCLE_SECONDS),
    finalAftersound,
    finalAftersoundOverflowCrit,
    partial,
    diagnostics,
  };
}
