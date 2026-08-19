import {
  generatedCharacterBoxCharacterBases10R1,
  generatedCharacterBoxWeaponBases10R1,
} from "@/generated/character-box-roster-baselines-10r1";
import { personalDpsRuntimeActionResourceOperations10R1 } from "@/data/personal-dps-runtime-action-overlays-10r1";
import { resolveReviewedPersonalDpsRuntimeBundle10R1 } from "@/data/personal-dps-runtime-reviewed-10r1";
import { resolvePersonalDpsBuildPassives10R1 } from "@/data/personal-dps-build-passives-10r1";
import { resolvePersonalDpsRotationContext10R1 } from "@/data/personal-dps-rotation-context-10r1";
import type { PersonalDpsProfileV1, PersonalDpsRotationStepV1 } from "./personal-dps-engine";
import { simulatePersonalCombat, type PersonalDiagnostic } from "./personal-combat-simulation";
import { resolveActiveEffects } from "./effect-engine";
import { calculateUncategorizedDamageV1 } from "./uncategorized-damage";
import type { DamageAmounts, DamageTarget, ScalingAttribute } from "./damage-engine";
import type { CombatAction, CombatResource, Resonator, UserBuild } from "./models";
import {
  buildTemporalTimeline,
  temporalProfilesV01,
  type TemporalProfileId,
  type TemporalTimeline,
} from "./temporal-engine";

const zero = (): DamageAmounts => ({ nonCrit: 0, crit: 0, expected: 0 });
const add = (a: DamageAmounts, b: DamageAmounts): DamageAmounts => ({
  nonCrit: a.nonCrit + b.nonCrit,
  crit: a.crit + b.crit,
  expected: a.expected + b.expected,
});

interface ExpandedStep {
  action: CombatAction;
  rotationStep: PersonalDpsRotationStepV1;
  rotationStepIndex: number;
  repetition: number;
}

export interface PersonalDpsSimulationResultV1 {
  status: "supported" | "partial";
  resonatorId: string;
  rotationId: string;
  timingConfidence: TemporalTimeline["confidence"];
  rotationDurationSeconds: number;
  totals: DamageAmounts;
  dps: DamageAmounts;
  perAction: Readonly<Record<string, DamageAmounts>>;
  diagnostics: readonly PersonalDiagnostic[];
  activeEffectIds: readonly string[];
}

export interface PersonalDpsSimulationRequestV1 {
  profile: PersonalDpsProfileV1;
  resonator: Resonator;
  build: UserBuild;
  rotationId: string;
  target: DamageTarget & { id?: string };
  scalingAttribute?: ScalingAttribute;
}

function temporalProfileFor(action: CombatAction): TemporalProfileId {
  if (action.talent === "introSkill") return "intro";
  if (action.talent === "outroSkill") return "outro";
  if (action.talent === "echoSkill") return "echo-skill";
  if (action.damageType === "heavyAttack") return "heavy";
  if (action.damageType === "resonanceLiberation") return "liberation-long";
  if (action.talent === "resonanceSkill" || action.talent === "forteCircuit") {
    return "skill-medium";
  }
  if (action.damageType === "basicAttack") return "basic-medium";
  return "very-short";
}

function exactHitCount(action: CombatAction): number {
  return action.multipliers.reduce((sum, group) => sum + group.hits, 0);
}

function withEstimatedHitTimings(timeline: TemporalTimeline, steps: readonly ExpandedStep[]): TemporalTimeline {
  return {
    ...timeline,
    entries: timeline.entries.map((entry, index) => {
      const hits = exactHitCount(steps[index]!.action);
      const hitTimingsSeconds = Array.from(
        { length: hits },
        (_, hitIndex) =>
          (entry.effectiveDurationSeconds * (hitIndex + 1)) / (hits + 1),
      );
      return {
        ...entry,
        hitTimingsSeconds,
        notes: [
          ...entry.notes,
          "Hit timings are evenly distributed estimates inside the action window; total action timing uses the shared Temporal Engine profile.",
        ],
      };
    }),
  };
}

function expandRotation(
  profile: PersonalDpsProfileV1,
  rotationId: string,
): { rotation: PersonalDpsProfileV1["rotations"][number]; steps: ExpandedStep[] } {
  const rotation = profile.rotations.find((candidate) => candidate.id === rotationId);
  if (!rotation) throw new Error(`Unknown rotation ${rotationId}.`);
  const actions = new Map(profile.actions.map((action) => [action.id, action] as const));
  const steps: ExpandedStep[] = [];
  for (const [rotationStepIndex, step] of rotation.steps.entries()) {
    const action = actions.get(step.actionId);
    if (!action) throw new Error(`Unknown action ${step.actionId} in ${rotation.id}.`);
    for (let repetition = 0; repetition < (step.count ?? 1); repetition += 1) {
      steps.push({ action, rotationStep: step, rotationStepIndex, repetition });
    }
  }
  return { rotation, steps };
}

function buildTimeline(
  rotation: PersonalDpsProfileV1["rotations"][number],
  steps: readonly ExpandedStep[],
): TemporalTimeline {
  const base = buildTemporalTimeline({
    id: rotation.id,
    name: rotation.name,
    policy: "no-quickswap",
    steps: steps.map(({ action, rotationStepIndex, repetition }, index) => {
      const profileId = temporalProfileFor(action);
      return {
        id: `${rotation.id}:${rotationStepIndex}:${repetition}`,
        label: action.name,
        actionId: action.id,
        rotationStepIndex: index,
        duration: {
          confidence: "estimated-default" as const,
          profileId,
          sourceNote: `Universal action-class estimate: ${temporalProfilesV01[profileId].label}.`,
        },
        recoverySeconds: null,
        cancelTimingSeconds: null,
        hitTimingsSeconds: null,
      };
    }),
    ...(rotation.durationSeconds !== undefined
      ? {
          targetDuration: {
            seconds: rotation.durationSeconds,
            confidence: "reviewed-total",
            source: rotation.sourceNote ?? "Reviewed rotation duration",
          },
        }
      : {}),
  });
  return withEstimatedHitTimings(base, steps);
}

function runtimeBaseStatBasis(build: UserBuild) {
  const characters = generatedCharacterBoxCharacterBases10R1 as Readonly<
    Record<string, { hp: number; attack: number; defense: number; level: number; weaponType: string } | undefined>
  >;
  const weapons = generatedCharacterBoxWeaponBases10R1 as Readonly<
    Record<string, { attack: number; level: number; type: string } | undefined>
  >;
  const character = characters[build.resonatorId];
  const weapon = weapons[build.weapon.weaponId];
  if (
    !character ||
    !weapon ||
    build.characterLevel !== character.level ||
    build.weapon.level !== weapon.level ||
    weapon.type !== character.weaponType
  ) {
    return undefined;
  }
  return {
    hp: character.hp,
    attack: character.attack + weapon.attack,
    defense: character.defense,
    provenance: "Exact generated GameDatabase Lv90 character + equipped reviewed weapon base stats",
  };
}

function runtimeResonator(
  resonator: Resonator,
  actions: readonly CombatAction[],
  runtimeResources: readonly { id: string; name: string; cap: number }[],
): Resonator {
  const existing = resonator.combat;
  const resources = new Map<string, CombatResource>();
  for (const resource of existing?.resources ?? []) resources.set(resource.id, resource);
  for (const resource of runtimeResources) {
    resources.set(resource.id, {
      ...resource,
      semantic: "character-resource",
      notes: ["Exact resource cap used by the universal personal-DPS runtime."],
    });
  }
  return {
    ...resonator,
    combat: {
      level10Only: existing?.level10Only ?? false,
      forms: existing?.forms ?? [resonator.name],
      ...(existing?.defaultForm ? { defaultForm: existing.defaultForm } : {}),
      modes: existing?.modes ?? [],
      resources: [...resources.values()],
      actions,
      effects: existing?.effects ?? [],
      rotations: existing?.rotations ?? [],
      unknowns: existing?.unknowns ?? [],
      source: existing?.source ?? resonator.source,
    },
  };
}

function overlayActions(
  profile: PersonalDpsProfileV1,
  extraActions: readonly CombatAction[],
): CombatAction[] {
  return [...profile.actions, ...extraActions].map((action) => {
    const resourceOperations = personalDpsRuntimeActionResourceOperations10R1[action.id];
    return resourceOperations ? { ...action, resourceOperations } : action;
  });
}

function prefixTimeline(timeline: TemporalTimeline, length: number): TemporalTimeline {
  if (length >= timeline.entries.length) return timeline;
  const entries = timeline.entries.slice(0, length);
  const finalDurationSeconds = entries.at(-1)?.endTimeSeconds ?? 0;
  return { ...timeline, entries, finalDurationSeconds };
}

function multiply(amounts: DamageAmounts, count: number): DamageAmounts {
  return {
    nonCrit: amounts.nonCrit * count,
    crit: amounts.crit * count,
    expected: amounts.expected * count,
  };
}

export function simulatePersonalDpsBuildV1(
  request: PersonalDpsSimulationRequestV1,
): PersonalDpsSimulationResultV1 {
  const { rotation, steps } = expandRotation(request.profile, request.rotationId);
  const rotationContext = resolvePersonalDpsRotationContext10R1(rotation.id);
  const timeline = buildTimeline(rotation, steps);
  const firstUncategorized = steps.findIndex(
    (step) => step.rotationStep.damageCategory === "uncategorized",
  );
  if (
    firstUncategorized >= 0 &&
    steps.slice(firstUncategorized).some(
      (step) => step.rotationStep.damageCategory !== "uncategorized",
    )
  ) {
    throw new Error("Uncategorized damage is currently required to be trailing in a rotation.");
  }

  const bundle = resolveReviewedPersonalDpsRuntimeBundle10R1(request.build);
  const permanentPassives = resolvePersonalDpsBuildPassives10R1(request.build);
  const actions = overlayActions(request.profile, bundle.actions);
  const resonator = runtimeResonator(request.resonator, actions, bundle.resources);
  const standardLength = firstUncategorized < 0 ? steps.length : firstUncategorized;
  const combat = simulatePersonalCombat({
    resonator,
    build: request.build,
    timeline: prefixTimeline(timeline, standardLength),
    target: request.target,
    ...(rotationContext.resonanceMode
      ? { resonanceMode: rotationContext.resonanceMode }
      : {}),
    scalingAttribute: request.scalingAttribute ?? request.profile.defaultScalingAttribute,
    actions,
    loadout: { extraEffects: [...permanentPassives, ...bundle.effects] },
    baseStatBasis: runtimeBaseStatBasis(request.build),
  });

  let totals = combat.personalDamage;
  const perAction: Record<string, DamageAmounts> = { ...combat.perAction };
  const diagnostics: PersonalDiagnostic[] = [...combat.diagnostics];

  if (firstUncategorized >= 0) {
    for (const step of steps.slice(firstUncategorized)) {
      const active = combat.finalState.activeEffects.filter(
        (effect) => effect.ownerId === resonator.id,
      );
      const resolved = resolveActiveEffects(active, {
        actorId: resonator.id,
        targetId: request.target.id ?? "target",
        teamMemberIds: [resonator.id],
        element: request.profile.element,
        actionId: step.action.id,
        ...(rotationContext.resonanceMode
          ? { resonanceMode: rotationContext.resonanceMode }
          : {}),
      });
      const result = calculateUncategorizedDamageV1({
        action: step.action,
        finalStats: request.build.finalStats,
        attackerLevel: request.build.characterLevel,
        scalingAttribute: request.scalingAttribute ?? request.profile.defaultScalingAttribute,
        element: request.profile.element,
        target: request.target,
        modifiers: resolved.damageModifiers,
      });
      if (result.status === "unsupported") {
        diagnostics.push({
          code: result.reason,
          message: result.message,
          actionId: step.action.id,
          relevance: "relevant-unsupported",
        });
        continue;
      }
      const amount = multiply(result.total, 1);
      totals = add(totals, amount);
      perAction[step.action.id] = add(perAction[step.action.id] ?? zero(), amount);
    }
  }

  const dps = multiply(totals, 1 / timeline.finalDurationSeconds);
  const partial = diagnostics.some(
    (diagnostic) =>
      diagnostic.relevance === "relevant-unsupported" ||
      diagnostic.relevance === "not-emitted-due-to-missing-context",
  );

  return {
    status: partial ? "partial" : "supported",
    resonatorId: request.profile.resonatorId,
    rotationId: rotation.id,
    timingConfidence: timeline.confidence,
    rotationDurationSeconds: timeline.finalDurationSeconds,
    totals,
    dps,
    perAction,
    diagnostics,
    activeEffectIds: combat.finalState.activeEffects.map((effect) => effect.definition.id),
  };
}
