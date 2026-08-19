import type { RuntimeBaseStatBasis } from "./combat-context";
import type { ActionDefinitionV02 } from "./effect-models";
import type { CombatAction, FinalStats, MainEcho, Resonator, Sonata, UserBuild, Weapon } from "./models";
import { simulatePersonalCombat, type PersonalCombatResult } from "./personal-combat-simulation";
import { emptyCombatState, type CombatEvent, type CombatState } from "./state-engine";
import { buildTheoreticalRotationTimeline } from "./theoretical-rotation";
import type { DamageTarget } from "./damage-engine";
import type {
  PersonalRotationScenario,
  RotationSpecialEventPreset,
  SequencePayloadOverride,
} from "@/data/personal-rotation-presets";

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
): SequencePayloadOverride | undefined =>
  [...(overrides ?? [])]
    .filter((override) => override.minimumSequence <= sequence)
    .sort((a, b) => a.minimumSequence - b.minimumSequence)
    .at(-1);

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
    if (!anchor) {
      throw new Error(
        `Rotation scenario ${scenario.id} references missing step ${preset.anchor.stepIndex} for ${preset.id}.`,
      );
    }
    const baseTime = preset.anchor.at === "start"
      ? anchor.startTimeSeconds
      : anchor.endTimeSeconds;
    const repeat = preset.repeat ?? 1;
    if (!Number.isInteger(repeat) || repeat <= 0) {
      throw new Error(`Rotation special event ${preset.id} has an invalid repeat count.`);
    }
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

function initialStateForScenario(
  scenario: PersonalRotationScenario,
  resonator: Resonator,
  stats: FinalStats,
  targetId: string,
): CombatState {
  const resources = Object.fromEntries(
    (resonator.combat?.resources ?? []).map((resource) => {
      const current = scenario.initialResources?.[resource.id] ?? 0;
      if (!Number.isFinite(current) || current < 0 || current > resource.cap) {
        throw new Error(
          `Rotation scenario ${scenario.id} has invalid initial ${resource.id}: ${current}/${resource.cap}.`,
        );
      }
      return [resource.id, { current, max: resource.cap }];
    }),
  );
  return emptyCombatState(
    {
      [resonator.id]: {
        hp: stats.hp,
        maxHp: stats.hp,
        onField: true,
        form: resonator.combat?.defaultForm,
        namedStates: ["ground"],
        resources,
      },
    },
    [targetId],
  );
}

function scenarioActions(
  scenario: PersonalRotationScenario,
  actions: readonly CombatAction[],
): readonly (ActionDefinitionV02 | CombatAction)[] {
  if (!scenario.assumeLegacyRequirementsSatisfied) return actions;
  return actions.map((action) => ({
    action,
    requirements: [],
  }));
}

export function runTheoreticalPersonalRotation(
  request: TheoreticalPersonalRotationRequest,
): TheoreticalPersonalRotationResult {
  if (request.scenario.resonatorId !== request.resonator.id) {
    throw new Error(
      `Rotation scenario ${request.scenario.id} belongs to ${request.scenario.resonatorId}, not ${request.resonator.id}.`,
    );
  }
  const targetId = request.target.id ?? "training-target";
  const timeline = buildTheoreticalRotationTimeline(
    request.scenario.rotation,
    request.actions,
  );
  const externalEvents = compileSpecialEvents(
    request.scenario,
    timeline,
    request.build,
    request.resonator.id,
    targetId,
  );
  const build = { ...request.build, finalStats: request.stats };
  const simulation = simulatePersonalCombat({
    resonator: request.resonator,
    build,
    timeline,
    target: { ...request.target, id: targetId },
    resonanceMode: request.scenario.resonanceMode ?? request.resonanceMode,
    baseStatBasis: request.baseStatBasis,
    actions: scenarioActions(request.scenario, request.actions),
    loadout: {
      weapon: request.weapon,
      sonata: request.sonata,
      mainEcho: request.mainEcho,
      extraEffects: request.scenario.extraEffects,
    },
    initialState: initialStateForScenario(
      request.scenario,
      request.resonator,
      request.stats,
      targetId,
    ),
    externalEvents,
  });
  return { scenario: request.scenario, simulation };
}
