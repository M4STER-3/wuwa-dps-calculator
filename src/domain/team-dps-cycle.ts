import type { DamageTarget } from "./damage-engine";
import type { CombatEvent } from "./state-engine";
import {
  simulateTeam,
  type TeamSimulationInput,
  type TeamSimulationResult,
} from "./team-engine";
import { adaptPersonalRotationToTeamBlock } from "./team-personal-rotation-adapter";
import { buildSequentialTeamCycle } from "./team-rotation-builder";

export type CycleRepeatability =
  | "repeatable"
  | "not-repeatable"
  | "partial-unknown";

export interface TeamDpsSummary {
  available: boolean;
  reason?: string;
  durationSeconds?: number;
  totalExpectedDamage: number;
  /** DPS of the damage that actually resolved. May be provisional when `available` is false. */
  resolvedDps?: number;
  /** Authoritative Team DPS. Only present when the simulation is complete and non-blocking. */
  teamDps?: number;
  byActor: Readonly<
    Record<
      string,
      {
        expectedDamage: number;
        dps?: number;
        contributionPercent: number;
      }
    >
  >;
}

export interface TeamCycleValidation {
  cycle1: TeamSimulationResult;
  cycle2: TeamSimulationResult;
  dps: TeamDpsSummary;
  repeatability: CycleRepeatability;
  cycle1Signature: readonly string[];
  cycle2Signature: readonly string[];
  diagnostics: readonly string[];
}

const blocking = new Set([
  "timing-required",
  "hit-timing-required",
  "hit-count-mismatch",
  "action-resource-rejected",
  "action-cooldown",
  "inactive-actor-action",
  "invalid-switch-target",
  "requirement-context-required",
  "modifier-context-required",
  "unknown-action",
  "missing-scaling-owner",
  "missing-damage-owner",
]);

interface AutomaticPersonalCycleEvents {
  relativeEvents: readonly CombatEvent[];
}

function sameRotationSteps(
  left: TeamSimulationInput["steps"],
  right: TeamSimulationInput["steps"],
): boolean {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

/**
 * Detects the exact automatic Personal -> Team cycle without relying on UI state.
 * Only that exact cycle inherits Personal scenario events; authored/manual Team
 * rotations keep their explicit event contract.
 */
function automaticPersonalCycleEvents(
  input: TeamSimulationInput,
): AutomaticPersonalCycleEvents | undefined {
  if (!input.actors.length || !input.steps?.length) return undefined;

  const adapted = input.actors.map((actor) =>
    adaptPersonalRotationToTeamBlock(actor, actor.resonanceMode),
  );
  if (adapted.some((rotation) => rotation.diagnostics.length > 0)) {
    return undefined;
  }
  const automaticCycle = buildSequentialTeamCycle(
    adapted.map((rotation) => rotation.rotation),
  );
  if (
    automaticCycle.diagnostics.length > 0 ||
    automaticCycle.startingActorId !== input.activeActorId ||
    !sameRotationSteps(automaticCycle.steps, input.steps)
  ) {
    return undefined;
  }

  const relativeEvents: CombatEvent[] = [];
  let blockStartSeconds = 0;
  for (const rotation of adapted) {
    if (rotation.teamBlockDurationSeconds === undefined) return undefined;
    for (const event of rotation.scenarioEvents) {
      relativeEvents.push({
        ...event,
        timestamp: blockStartSeconds + event.timestamp,
        external: true,
      });
    }
    blockStartSeconds += rotation.teamBlockDurationSeconds;
  }
  return { relativeEvents };
}

function shiftScenarioEvents(
  events: readonly CombatEvent[],
  offsetSeconds: number,
  cycleId: string,
): readonly CombatEvent[] {
  return events.map((event) => ({
    ...event,
    id: `${event.id}:${cycleId}`,
    timestamp: offsetSeconds + event.timestamp,
    external: true,
  }));
}

export function summarizeTeamDps(result: TeamSimulationResult): TeamDpsSummary {
  const duration = result.resolvedDurationSeconds;
  const blocked = result.diagnostics.some((diagnostic) =>
    blocking.has(diagnostic.code),
  );
  const totalExpectedDamage = result.totalResolvedDamage.expected;
  const resolvedDps =
    duration !== undefined && duration > 0
      ? totalExpectedDamage / duration
      : undefined;
  const available =
    resolvedDps !== undefined && !blocked && !result.partial;
  const byActor = Object.fromEntries(
    Object.entries(result.damageByActorId).map(([actorId, value]) => [
      actorId,
      {
        expectedDamage: value.expected,
        dps: available ? value.expected / duration! : undefined,
        contributionPercent:
          totalExpectedDamage > 0
            ? (value.expected / totalExpectedDamage) * 100
            : 0,
      },
    ]),
  );

  return {
    available,
    reason:
      duration === undefined || duration <= 0
        ? "unresolved timing"
        : blocked || result.partial
          ? "partial simulation"
          : undefined,
    durationSeconds: duration,
    totalExpectedDamage,
    resolvedDps,
    teamDps: available ? resolvedDps : undefined,
    byActor,
  };
}

export function executionSignature(
  result: TeamSimulationResult,
): readonly string[] {
  return result.eventLog
    .filter((event) =>
      ["action-start", "switch-out", "switch-in", "outro", "intro"].includes(
        event.kind,
      ),
    )
    .map((event) =>
      event.kind === "action-start"
        ? `action:${event.ownerId}:${event.actionId ?? event.payload?.sourceEntityId ?? ""}`
        : `${event.kind}:${event.ownerId}:${String(event.payload?.incomingActorId ?? "")}`,
    );
}

export function validateTeamCycle(
  input: TeamSimulationInput,
): TeamCycleValidation {
  const automaticEvents = automaticPersonalCycleEvents(input);
  const cycle1Start = input.initialState?.currentTimeSeconds ?? 0;
  const cycle1ScenarioEvents = automaticEvents
    ? shiftScenarioEvents(automaticEvents.relativeEvents, cycle1Start, "cycle-1")
    : [];
  const cycle1 = simulateTeam({
    ...input,
    externalEvents: [
      ...(input.externalEvents ?? []),
      ...cycle1ScenarioEvents,
    ],
  });

  const cycle2Start = cycle1.finalState.currentTimeSeconds;
  const cycle2ScenarioEvents = automaticEvents
    ? shiftScenarioEvents(automaticEvents.relativeEvents, cycle2Start, "cycle-2")
    : [];
  const cycle2 = simulateTeam({
    actors: [],
    activeActorId: cycle1.finalState.activeActorId,
    target: input.target,
    steps: input.steps ?? [],
    initialState: cycle1.finalState,
    externalEvents: cycle2ScenarioEvents,
  });
  const cycle1Signature = executionSignature(cycle1);
  const cycle2Signature = executionSignature(cycle2);
  const cycle2BlockingDiagnostics = cycle2.diagnostics.filter((diagnostic) =>
    blocking.has(diagnostic.code),
  );
  const unknown = [...cycle1.diagnostics, ...cycle2.diagnostics].filter(
    (diagnostic) =>
      diagnostic.code === "team-energy-propagation-required" ||
      diagnostic.code === "timing-required" ||
      diagnostic.code === "hit-timing-required" ||
      diagnostic.code === "hit-count-mismatch",
  );
  const structureChanged =
    JSON.stringify(cycle1Signature) !== JSON.stringify(cycle2Signature);
  const repeatability: CycleRepeatability = unknown.length
    ? "partial-unknown"
    : cycle2BlockingDiagnostics.length || structureChanged
      ? "not-repeatable"
      : "repeatable";

  return {
    cycle1,
    cycle2,
    dps: summarizeTeamDps(cycle1),
    repeatability,
    cycle1Signature,
    cycle2Signature,
    diagnostics: [
      ...cycle2BlockingDiagnostics.map(
        (diagnostic) => `${diagnostic.code}: ${diagnostic.message}`,
      ),
      ...(structureChanged ? ["cycle-structure-changed"] : []),
    ],
  };
}
