import type { DamageTarget } from "./damage-engine";
import {
  simulateTeam,
  simulateTeamContinuation,
  type TeamSimulationInput,
  type TeamSimulationResult,
} from "./team-engine";

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
  const cycle1 = simulateTeam(input);
  const cycle2 = simulateTeamContinuation(
    cycle1.finalState,
    input.steps ?? [],
    input.target,
  );
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
