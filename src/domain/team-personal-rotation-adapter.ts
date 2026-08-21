import type { PersonalRotationScenario } from "@/data/personal-rotation-presets";

import type { CombatAction, Resonator, UserBuild } from "./models";
import { selectPersonalRotationScenario } from "./personal-rotation-selection";
import { withPreciseMainEchoCast } from "./precise-main-echo-scenarios";
import type { TeamActorInput } from "./team-engine";
import type {
  SequentialTeamActorRotation,
  SequentialTeamLocalStep,
} from "./team-rotation-builder";
import type { TemporalRotationDefinition } from "./temporal-engine";
import { buildTheoreticalRotationTimeline } from "./theoretical-rotation";

export interface TeamPersonalRotationDiagnostic {
  code: string;
  message: string;
}

export interface AdaptedTeamPersonalRotation {
  actorId: string;
  resonatorId: string;
  scenarioId?: string;
  scenarioName?: string;
  resonanceMode?: string;
  rotation: SequentialTeamActorRotation;
  sourceDurationSeconds?: number;
  teamBlockDurationSeconds?: number;
  diagnostics: readonly TeamPersonalRotationDiagnostic[];
}

type ScenarioWithTargetDuration = PersonalRotationScenario & {
  targetDuration?: TemporalRotationDefinition["targetDuration"];
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
  const candidates = eligible.filter(
    (rotation) => rotation.sequence === highestSequence,
  );
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

function scenarioRotationTarget(
  scenario: PersonalRotationScenario,
  resonator: Resonator,
  sequence: UserBuild["sequence"],
): TemporalRotationDefinition["targetDuration"] | undefined {
  const scenarioTarget = (scenario as ScenarioWithTargetDuration).targetDuration;
  return scenarioTarget ?? reviewedRotationTarget(resonator, sequence);
}

function runtimeActions(actor: TeamActorInput): readonly CombatAction[] {
  const values = [
    ...(actor.resonator.combat?.actions ?? []),
    ...(actor.mainEcho?.action ? [actor.mainEcho.action] : []),
    ...(actor.actions ?? []),
  ];
  return [...new Map(values.map((action) => [action.id, action])).values()];
}

function teamOwnsTransition(
  action: CombatAction | undefined,
  profileId: string | undefined,
): boolean {
  return (
    action?.talent === "introSkill" ||
    action?.talent === "outroSkill" ||
    profileId === "intro" ||
    profileId === "outro"
  );
}

/**
 * Converts the same theoretical Personal DPS rotation into one contiguous Team
 * on-field block. Intro/Outro actions are not authored as Team actions because
 * the switch lifecycle owns them; their theoretical occupancy is preserved as
 * waits so the shared rotation duration is not silently shortened.
 */
export function adaptPersonalRotationToTeamBlock(
  actor: TeamActorInput,
  resonanceMode?: string,
): AdaptedTeamPersonalRotation {
  const diagnostics: TeamPersonalRotationDiagnostic[] = [];
  const baseScenario = selectPersonalRotationScenario(
    actor.resonator.id,
    resonanceMode,
    actor.build.personalScenarioId,
  );
  if (!baseScenario) {
    diagnostics.push({
      code: "missing-personal-rotation-scenario",
      message: `No Personal DPS rotation scenario is registered for ${actor.resonator.id}.`,
    });
    return {
      actorId: actor.actorId,
      resonatorId: actor.resonator.id,
      resonanceMode,
      rotation: { actorId: actor.actorId, steps: [] },
      diagnostics,
    };
  }

  const availableActions = runtimeActions(actor);
  const scenario = withPreciseMainEchoCast(
    baseScenario,
    actor.resonator.id,
    actor.mainEcho,
    availableActions,
  );
  const timelineActions = [
    ...availableActions,
    ...(scenario.extraActions ?? []),
  ];
  const runtimeById = new Map(availableActions.map((action) => [action.id, action]));
  const timelineById = new Map(timelineActions.map((action) => [action.id, action]));

  let timeline: ReturnType<typeof buildTheoreticalRotationTimeline>;
  try {
    timeline = buildTheoreticalRotationTimeline(
      scenario.rotation,
      timelineActions,
      scenarioRotationTarget(scenario, actor.resonator, actor.build.sequence),
    );
  } catch (error) {
    diagnostics.push({
      code: "personal-rotation-timeline-error",
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      actorId: actor.actorId,
      resonatorId: actor.resonator.id,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      resonanceMode: scenario.resonanceMode ?? resonanceMode,
      rotation: { actorId: actor.actorId, steps: [] },
      diagnostics,
    };
  }

  const steps: SequentialTeamLocalStep[] = [];
  for (const entry of timeline.entries) {
    const timelineAction = entry.actionId
      ? timelineById.get(entry.actionId)
      : undefined;

    if (teamOwnsTransition(timelineAction, entry.profileId)) {
      steps.push({ kind: "wait", seconds: entry.effectiveDurationSeconds });
      continue;
    }

    if (!entry.actionId) {
      steps.push({ kind: "wait", seconds: entry.effectiveDurationSeconds });
      continue;
    }

    if (!runtimeById.has(entry.actionId)) {
      diagnostics.push({
        code: "personal-rotation-action-not-bound",
        message: `${scenario.id} requires ${entry.actionId}, but that action is not bound to Team runtime for ${actor.actorId}.`,
      });
      continue;
    }

    steps.push({
      kind: "action",
      actionId: entry.actionId,
      durationOverrideSeconds: entry.effectiveDurationSeconds,
    });
  }

  if (diagnostics.length) {
    return {
      actorId: actor.actorId,
      resonatorId: actor.resonator.id,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      resonanceMode: scenario.resonanceMode ?? resonanceMode,
      rotation: { actorId: actor.actorId, steps: [] },
      sourceDurationSeconds: timeline.finalDurationSeconds,
      diagnostics,
    };
  }

  const teamBlockDurationSeconds = steps.reduce(
    (total, step) =>
      total +
      (step.kind === "wait"
        ? step.seconds
        : step.durationOverrideSeconds ?? 0),
    0,
  );

  return {
    actorId: actor.actorId,
    resonatorId: actor.resonator.id,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    resonanceMode: scenario.resonanceMode ?? resonanceMode,
    rotation: { actorId: actor.actorId, steps },
    sourceDurationSeconds: timeline.finalDurationSeconds,
    teamBlockDurationSeconds,
    diagnostics,
  };
}
