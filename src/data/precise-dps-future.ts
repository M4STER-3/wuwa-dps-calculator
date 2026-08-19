import type { PersonalRotationScenario } from "./personal-rotation-presets";
import type {
  CombatAction,
  CombatResource,
  Resonator,
  ResonatorCombatData,
  Weapon,
} from "@/domain/models";
import type { TemporalProfileId } from "@/domain/temporal-engine";
import type { TheoreticalRotationPreset } from "@/domain/theoretical-rotation";
import { generatedPreciseDpsFutureProjection } from "@/generated/precise-dps-future-projection";
import { applyPreciseQiuyuanActionPatches } from "./precise-dps-qiuyuan-core";
import {
  applyPreciseSpecialActionPatches,
  preciseScenarioMechanicsFor,
} from "./precise-dps-special-mechanics";
import rawActionPins from "./precise-dps-action-pins.json";
import rawRegistry from "./precise-dps-future-registry.json";

type ProjectedAction = CombatAction & {
  readonly sourceAttributeId?: string;
  readonly sourceSkillId?: string;
  readonly sourceSkillName?: string;
  readonly sourceSkillType?: string;
};

type ActionSelector = {
  actionId?: string;
  talent?: CombatAction["talent"];
  sourceSkillId?: string;
  sourceAttributeId?: string;
  nameIncludes: readonly string[];
  nameExcludes: readonly string[];
  sourceSkillNameIncludes: readonly string[];
};

type RecipeStep =
  | { selector: ActionSelector; repeat?: number; profileId?: TemporalProfileId }
  | { label: string; repeat?: number; profileId?: TemporalProfileId };

type ScenarioRecipe = {
  id: string;
  label: string;
  resonanceMode?: string;
  variant?: string;
  eligibility?: string;
  reviewedDurationSeconds?: number;
  steps?: readonly RecipeStep[];
  stepsFromScenario?: string;
};

type CombatModelRecipe = {
  forms: readonly string[];
  defaultForm: string;
  modes: readonly string[];
  resources: readonly { id: string; name: string; cap: number }[];
};

type RegistryEntry = {
  id: string;
  name: string;
  signatureWeaponName: string;
  mechanicsStatus: "partial" | "complete";
  combatModel?: CombatModelRecipe;
  scenarios: readonly ScenarioRecipe[];
};

type Registry = {
  version: 1;
  sourcePolicy: string;
  entries: readonly RegistryEntry[];
};

type ActionPin = {
  resonatorId: string;
  scenarioId: string;
  stepIndex: number;
  sourceAttributeId: string;
};

type ActionPinRegistry = {
  version: 1;
  pins: readonly ActionPin[];
};

const registry = rawRegistry as Registry;
if (registry.version !== 1) {
  throw new Error("Precise DPS future registry: unsupported version.");
}

const actionPinRegistry = rawActionPins as ActionPinRegistry;
if (actionPinRegistry.version !== 1 || !Array.isArray(actionPinRegistry.pins)) {
  throw new Error("Precise DPS action pins: unsupported version or invalid pins.");
}
const actionPins = new Map<string, ActionPin>();
for (const pin of actionPinRegistry.pins) {
  if (
    !pin ||
    typeof pin.resonatorId !== "string" ||
    typeof pin.scenarioId !== "string" ||
    !Number.isInteger(pin.stepIndex) ||
    pin.stepIndex < 0 ||
    typeof pin.sourceAttributeId !== "string" ||
    !pin.sourceAttributeId
  ) {
    throw new Error("Precise DPS action pins: invalid pin entry.");
  }
  const key = `${pin.resonatorId}:${pin.scenarioId}:${pin.stepIndex}`;
  if (actionPins.has(key)) {
    throw new Error(`Precise DPS action pins: duplicate pin ${key}.`);
  }
  actionPins.set(key, pin);
}

const normalize = (value: string): string =>
  value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

const containsAll = (value: string, needles: readonly string[]): boolean => {
  const haystack = normalize(value);
  return needles.every((needle) => haystack.includes(normalize(needle)));
};

function matchesSelector(action: ProjectedAction, selector: ActionSelector): boolean {
  if (selector.actionId && action.id !== selector.actionId) return false;
  if (selector.talent && action.talent !== selector.talent) return false;
  if (selector.sourceSkillId && action.sourceSkillId !== selector.sourceSkillId) return false;
  if (selector.sourceAttributeId && action.sourceAttributeId !== selector.sourceAttributeId) return false;
  if (!containsAll(action.name, selector.nameIncludes)) return false;
  const normalizedName = normalize(action.name);
  if (selector.nameExcludes.some((needle) => normalizedName.includes(normalize(needle)))) return false;
  return containsAll(action.sourceSkillName ?? "", selector.sourceSkillNameIncludes);
}

function parseSelector(raw: unknown, label: string): ActionSelector {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${label} must be an object.`);
  }
  const input = raw as Record<string, unknown>;
  const strings = (value: unknown): readonly string[] =>
    value === undefined
      ? []
      : Array.isArray(value) && value.every((item) => typeof item === "string")
        ? value
        : (() => { throw new Error(`${label} has an invalid string selector.`); })();
  return {
    ...(typeof input.actionId === "string" ? { actionId: input.actionId } : {}),
    ...(typeof input.talent === "string" ? { talent: input.talent as CombatAction["talent"] } : {}),
    ...(typeof input.sourceSkillId === "string" ? { sourceSkillId: input.sourceSkillId } : {}),
    ...(typeof input.sourceAttributeId === "string" ? { sourceAttributeId: input.sourceAttributeId } : {}),
    nameIncludes: strings(input.nameIncludes),
    nameExcludes: strings(input.nameExcludes),
    sourceSkillNameIncludes: strings(input.sourceSkillNameIncludes),
  };
}

function normalizeRecipeStep(raw: unknown, label: string): RecipeStep {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${label} must be an object.`);
  const input = raw as Record<string, unknown>;
  const repeat = input.repeat === undefined ? undefined : Number(input.repeat);
  if (repeat !== undefined && (!Number.isInteger(repeat) || repeat <= 0 || repeat > 30)) {
    throw new Error(`${label}.repeat is invalid.`);
  }
  const profileId = typeof input.profileId === "string" ? input.profileId as TemporalProfileId : undefined;
  if (input.selector !== undefined) {
    return { selector: parseSelector(input.selector, `${label}.selector`), ...(repeat ? { repeat } : {}), ...(profileId ? { profileId } : {}) };
  }
  if (typeof input.label !== "string" || !input.label) throw new Error(`${label} needs selector or label.`);
  return { label: input.label, ...(repeat ? { repeat } : {}), ...(profileId ? { profileId } : {}) };
}

function actionInventory(actions: readonly ProjectedAction[]): string {
  return actions
    .slice(0, 160)
    .map((action) =>
      `${action.sourceAttributeId ?? action.id}:${action.talent}:${action.sourceSkillName ?? "?"} > ${action.name}`,
    )
    .join(" | ");
}

function resolveAction(
  resonatorId: string,
  scenarioId: string,
  stepIndex: number,
  actions: readonly ProjectedAction[],
  selector: ActionSelector,
): ProjectedAction {
  const pin = actionPins.get(`${resonatorId}:${scenarioId}:${stepIndex}`);
  if (pin) {
    if (selector.sourceAttributeId && selector.sourceAttributeId !== pin.sourceAttributeId) {
      throw new Error(
        `Precise DPS ${resonatorId}/${scenarioId} step ${stepIndex} conflicts with pinned attribute ${pin.sourceAttributeId}.`,
      );
    }
    const pinned = actions.filter(
      (action) => action.sourceAttributeId === pin.sourceAttributeId,
    );
    if (pinned.length !== 1) {
      throw new Error(
        `Precise DPS ${resonatorId}/${scenarioId} step ${stepIndex} pin ${pin.sourceAttributeId} resolves to ${pinned.length} actions. Inventory: ${actionInventory(actions)}`,
      );
    }
    // A reviewed sourceAttributeId pin is authoritative over heuristic recipe
    // fields such as talent/name. This is required for GameDatabase actions whose
    // canonical talent classification differs from community-facing wording
    // (for example Jinhsi's Incarnation attacks are Forte Circuit actions).
    return pinned[0];
  }

  const matches = actions.filter((action) => matchesSelector(action, selector));
  if (matches.length !== 1) {
    throw new Error(
      `Precise DPS ${resonatorId}/${scenarioId} step ${stepIndex} resolves to ${matches.length} actions. Inventory: ${actionInventory(actions)}`,
    );
  }
  return matches[0];
}

function applyPreciseDamageTypeOverrides(
  resonatorId: string,
  actions: readonly ProjectedAction[],
): readonly ProjectedAction[] {
  return actions.map((action) => {
    const name = normalize(action.name);
    if (resonatorId === "lynae" && action.sourceAttributeId === "1509032") {
      return { ...action, damageType: "tuneRupture" };
    }
    if (resonatorId === "lynae" && (
      name.includes("polychrome leap") ||
      name.includes("visual impact") ||
      name.includes("iridescent splash") ||
      name.includes("graffiti blast") ||
      name.includes("kaleidoscopic parade ground heavy") ||
      name.includes("kaleidoscopic parade mid air heavy")
    )) {
      return { ...action, damageType: "basicAttack" };
    }
    if (resonatorId === "mornye" && action.sourceAttributeId === "1209028") {
      return { ...action, damageType: "resonanceLiberation" };
    }
    if (resonatorId === "mornye" && action.sourceAttributeId === "1209031") {
      return { ...action, damageType: "tuneRupture" };
    }
    if (resonatorId === "mornye" && (name.includes("geopotential shift") || name.includes("inversion"))) {
      return { ...action, damageType: "heavyAttack" };
    }
    return action;
  });
}

const preciseSource = {
  kind: "verified-game-data" as const,
  source: "WUWA GameDatabase V1 · precise DPS future projection",
  notes: "Identity, Lv90 base stats, signature weapon identity/base ATK and Lv1–10 action motion values are generated fail-closed from GameDatabase. Character-specific effects remain scenario-owned and explicitly partial until modeled.",
};

const scenarioSource = {
  kind: "community-calculation" as const,
  source: "Prydwen rotation recipe · WUWA LAB precise scenario projection",
  notes: registry.sourcePolicy,
};

function combatResources(model: CombatModelRecipe | undefined): readonly CombatResource[] {
  return (model?.resources ?? []).map((resource) => ({
    id: resource.id,
    name: resource.name,
    cap: resource.cap,
    semantic: "character-resource" as const,
    notes: ["Exact cap reviewed for the precise scenario model; generation/consumption is event-owned and must remain explicit."],
  }));
}

function oneReviewedDuration(entry: RegistryEntry): number | undefined {
  const durations = entry.scenarios
    .map((scenario) => scenario.reviewedDurationSeconds)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const unique = [...new Set(durations)];
  return unique.length === 1 ? unique[0] : undefined;
}

export const preciseDpsFutureResonators: readonly Resonator[] = registry.entries.map((entry) => {
  const projected = generatedPreciseDpsFutureProjection[
    entry.id as keyof typeof generatedPreciseDpsFutureProjection
  ];
  if (!projected) throw new Error(`Missing precise projection for ${entry.id}.`);
  const model = entry.combatModel;
  const specialActions = applyPreciseSpecialActionPatches(
    entry.id,
    applyPreciseDamageTypeOverrides(
      entry.id,
      projected.actions as unknown as readonly ProjectedAction[],
    ),
  ) as readonly ProjectedAction[];
  const actions = (entry.id === "qiuyuan"
    ? applyPreciseQiuyuanActionPatches(specialActions)
    : specialActions) as readonly ProjectedAction[];
  const duration = oneReviewedDuration(entry);
  const combat: ResonatorCombatData = {
    level10Only: false,
    forms: model?.forms ?? [entry.name],
    defaultForm: model?.defaultForm ?? entry.name,
    modes: model?.modes ?? [],
    resources: combatResources(model),
    actions,
    effects: [],
    rotations: duration
      ? [{
          id: `${entry.id}-reviewed-reference-duration`,
          name: `${entry.name} reviewed reference rotation duration`,
          sequence: 0,
          policy: "no-quickswap",
          steps: [],
          totalDurationSeconds: {
            value: duration,
            confidence: "community-calculation",
            sourceNote: "Reviewed Prydwen S0 rotation duration used only to calibrate the shared theoretical timeline.",
          },
          notes: ["Duration calibration only; this row does not claim frame-exact hit timestamps."],
          source: scenarioSource,
        }]
      : [],
    unknowns: [
      `Mechanics status: ${entry.mechanicsStatus}.`,
      "Weapon passive, Echo/Sonata build and character-specific runtime effects must be explicitly modeled before this character may be labelled complete.",
      "Exact animation-frame hit timestamps remain unavailable unless a reviewed scenario duration/profile states otherwise.",
    ],
    source: preciseSource,
  };
  return {
    id: projected.id,
    name: projected.name,
    element: projected.element,
    weaponType: projected.weaponType,
    rarity: projected.rarity,
    baseStats: [projected.baseStats],
    skillNames: projected.skillNames,
    resonanceChain: projected.resonanceChain,
    combat,
    source: preciseSource,
  } satisfies Resonator;
});

export const preciseDpsFutureWeapons: readonly Weapon[] = registry.entries.map((entry) => {
  const projected = generatedPreciseDpsFutureProjection[
    entry.id as keyof typeof generatedPreciseDpsFutureProjection
  ];
  if (!projected) throw new Error(`Missing precise weapon projection for ${entry.id}.`);
  return {
    id: projected.weapon.id,
    name: projected.weapon.name,
    type: projected.weapon.type,
    rarity: projected.weapon.rarity,
    level90Stats: {
      baseAttack: projected.weapon.level90Stats.baseAttack,
      displayBaseAttack: Math.round(projected.weapon.level90Stats.baseAttack),
    },
    passiveDescription: "Partiel · passif exact à structurer avant validation DPS complète.",
    source: preciseSource,
  } satisfies Weapon;
});

function rawScenarioSteps(entry: RegistryEntry, scenario: ScenarioRecipe): readonly RecipeStep[] | undefined {
  if (scenario.steps) return scenario.steps.map((step, index) => normalizeRecipeStep(step, `${entry.id}.${scenario.id}.steps[${index}]`));
  if (!scenario.stepsFromScenario) return undefined;
  const source = entry.scenarios.find((candidate) => candidate.id === scenario.stepsFromScenario);
  if (!source?.steps) throw new Error(`${entry.id}.${scenario.id} references missing steps source ${scenario.stepsFromScenario}.`);
  return source.steps.map((step, index) => normalizeRecipeStep(step, `${entry.id}.${scenario.id}.inheritedSteps[${index}]`));
}

export interface PreciseDpsScenarioInventoryEntry {
  resonatorId: string;
  scenarioId: string;
  label: string;
  resonanceMode?: string;
  variant?: string;
  mechanicsStatus: "partial" | "complete";
  executable: boolean;
  reviewedDurationSeconds?: number;
  eligibility?: string;
}

export const preciseDpsScenarioInventory: readonly PreciseDpsScenarioInventoryEntry[] = registry.entries.flatMap((entry) =>
  entry.scenarios.map((scenario) => ({
    resonatorId: entry.id,
    scenarioId: scenario.id,
    label: scenario.label,
    ...(scenario.resonanceMode ? { resonanceMode: scenario.resonanceMode } : {}),
    ...(scenario.variant ? { variant: scenario.variant } : {}),
    mechanicsStatus: entry.mechanicsStatus,
    executable: Boolean(rawScenarioSteps(entry, scenario)),
    ...(scenario.reviewedDurationSeconds ? { reviewedDurationSeconds: scenario.reviewedDurationSeconds } : {}),
    ...(scenario.eligibility ? { eligibility: scenario.eligibility } : {}),
  })),
);

export const preciseDpsFutureScenarios: readonly PersonalRotationScenario[] = registry.entries.flatMap((entry) => {
  const resonator = preciseDpsFutureResonators.find((candidate) => candidate.id === entry.id)!;
  const actions = resonator.combat!.actions as readonly ProjectedAction[];
  return entry.scenarios.flatMap((scenario) => {
    const recipe = rawScenarioSteps(entry, scenario);
    if (!recipe) return [];
    const mechanics = preciseScenarioMechanicsFor(scenario.id);
    const steps: TheoreticalRotationPreset["steps"] = recipe.map((step, stepIndex) => {
      if ("selector" in step) {
        const action = resolveAction(entry.id, scenario.id, stepIndex, actions, step.selector);
        return {
          actionId: action.id,
          ...(step.repeat ? { repeat: step.repeat } : {}),
          ...(step.profileId ? { profileId: step.profileId } : {}),
        };
      }
      return {
        label: step.label,
        ...(step.repeat ? { repeat: step.repeat } : {}),
        ...(step.profileId ? { profileId: step.profileId } : {}),
      };
    });
    return [{
      id: scenario.id,
      resonatorId: entry.id,
      name: `${entry.name} · ${scenario.label} · Partiel`,
      ...(scenario.resonanceMode ? { resonanceMode: scenario.resonanceMode } : {}),
      rotation: { id: scenario.id, name: `${entry.name} · ${scenario.label}`, steps },
      ...(mechanics?.initialResources ? { initialResources: mechanics.initialResources } : {}),
      ...(mechanics?.specialEvents ? { specialEvents: mechanics.specialEvents } : {}),
      ...(mechanics?.extraEffects ? { extraEffects: mechanics.extraEffects } : {}),
      assumeLegacyRequirementsSatisfied: true,
      notes: [
        registry.sourcePolicy,
        ...(scenario.eligibility ? [`Eligibility: ${scenario.eligibility}`] : []),
        ...(scenario.reviewedDurationSeconds ? [`Reviewed S0 reference duration: ${scenario.reviewedDurationSeconds}s.`] : []),
        "PARTIAL: exact GameDatabase motion values and reviewed runtime mechanics are executed, but missing equipment/team-context/timing mechanics still keep this scenario partial.",
      ],
    } satisfies PersonalRotationScenario];
  });
});
