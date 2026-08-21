import type { PersonalRotationScenario } from "@/data/personal-rotation-presets";
import type { CombatAction, MainEcho } from "./models";

type Placement = "after-intro" | "before-outro" | "after-second-forte";

const placementByResonator: Readonly<Record<string, Placement>> = {
  phrolova: "after-second-forte",
  denia: "before-outro",
  lynae: "after-intro",
  mornye: "before-outro",
  qiuyuan: "after-intro",
  jinhsi: "after-intro",
  galbrena: "after-intro",
  iuno: "after-intro",
  shorekeeper: "before-outro",
  hiyuki: "after-intro",
};

function actionIndexByTalent(
  steps: PersonalRotationScenario["rotation"]["steps"],
  actionsById: ReadonlyMap<string, CombatAction>,
  talent: CombatAction["talent"],
): number {
  return steps.findIndex((step) =>
    step.actionId ? actionsById.get(step.actionId)?.talent === talent : false,
  );
}

function insertionIndex(
  scenario: PersonalRotationScenario,
  actionsById: ReadonlyMap<string, CombatAction>,
  placement: Placement,
): number {
  const steps = scenario.rotation.steps;
  const outroIndex = actionIndexByTalent(steps, actionsById, "outroSkill");
  if (placement === "before-outro") return outroIndex >= 0 ? outroIndex : steps.length;

  const introIndex = actionIndexByTalent(steps, actionsById, "introSkill");
  if (placement === "after-intro") return introIndex >= 0 ? introIndex + 1 : 0;

  const forteIndices = steps.flatMap((step, index) =>
    step.actionId && actionsById.get(step.actionId)?.talent === "forteCircuit" ? [index] : [],
  );
  return forteIndices.length >= 2
    ? forteIndices[1]! + 1
    : outroIndex >= 0
      ? outroIndex
      : steps.length;
}

/**
 * Adds the equipped Main Echo cast to precise Character Box rotations without
 * inventing frame timings. The shared `echo-skill` theoretical profile remains
 * the timing authority. Existing special-event anchors are shifted when a new
 * step is inserted, so scenario-owned resource/status semantics keep pointing to
 * the same original actions.
 *
 * Galbrena already owns a reviewed Main Echo placeholder; that step is replaced
 * in place so its no-damage `echo-skill` Afterflame event is preserved without
 * double-counting Corrosaurus damage.
 */
export function withPreciseMainEchoCast(
  scenario: PersonalRotationScenario,
  resonatorId: string,
  mainEcho: MainEcho | undefined,
  actions: readonly CombatAction[],
): PersonalRotationScenario {
  const echoAction = mainEcho?.action;
  const placement = placementByResonator[resonatorId];
  if (!echoAction || !placement) return scenario;
  if (scenario.rotation.steps.some((step) => step.actionId === echoAction.id)) return scenario;

  const placeholderIndex = scenario.rotation.steps.findIndex(
    (step) => !step.actionId && /main echo cast/i.test(step.label ?? ""),
  );
  if (placeholderIndex >= 0) {
    const steps = [...scenario.rotation.steps];
    steps[placeholderIndex] = {
      actionId: echoAction.id,
      profileId: "echo-skill",
      notes: ["Build-owned Main Echo damage; scenario-owned trigger events remain separate."],
    };
    return {
      ...scenario,
      rotation: { ...scenario.rotation, steps },
      notes: [...scenario.notes, `Main Echo ${mainEcho.name} resolves the reviewed placeholder without changing event anchors.`],
    };
  }

  const actionsById = new Map(actions.map((action) => [action.id, action]));
  const index = insertionIndex(scenario, actionsById, placement);
  const steps = [
    ...scenario.rotation.steps.slice(0, index),
    {
      actionId: echoAction.id,
      profileId: "echo-skill" as const,
      notes: ["Equipped Main Echo cast; timing uses the shared theoretical Echo profile."],
    },
    ...scenario.rotation.steps.slice(index),
  ];
  const specialEvents = scenario.specialEvents?.map((event) => ({
    ...event,
    anchor: {
      ...event.anchor,
      stepIndex:
        event.anchor.stepIndex >= index
          ? event.anchor.stepIndex + 1
          : event.anchor.stepIndex,
    },
  }));

  return {
    ...scenario,
    rotation: { ...scenario.rotation, steps },
    ...(specialEvents ? { specialEvents } : {}),
    notes: [...scenario.notes, `Equipped Main Echo ${mainEcho.name} is executed as a real rotation action.`],
  };
}
