import type { CombatAction, SkillType } from "@/domain/models";
import { damageTypes, skillTypes } from "@/domain/models";
import {
  temporalProfileIds,
  type TemporalProfileId,
} from "@/domain/temporal-engine";
import type { TheoreticalRotationPreset } from "@/domain/theoretical-rotation";
import { generatedCharacterBoxCombat10R1 } from "@/generated/character-box-combat-10r1";
import rawRegistry from "./personal-dps-roster-registry.json";

type ScalingAttribute = NonNullable<CombatAction["scalingAttribute"]>;
type DamageType = NonNullable<CombatAction["damageType"]>;

type ProjectedAction = CombatAction & {
  readonly sourceAttributeId?: string;
  readonly sourceSkillId?: string;
  readonly sourceSkillName?: string;
  readonly sourceSkillType?: string;
};

interface ActionSelector {
  talent?: SkillType;
  sourceSkillId?: string;
  sourceAttributeId?: string;
  nameIncludes: readonly string[];
  nameExcludes: readonly string[];
  sourceSkillNameIncludes: readonly string[];
}

interface ActionOverride extends ActionSelector {
  damageType?: DamageType;
  scalingAttribute?: ScalingAttribute;
}

interface RotationSelectorStep {
  selector: ActionSelector;
  repeat?: number;
  profileId?: TemporalProfileId;
  allowTalentFallback: boolean;
}

interface RotationTransitionStep {
  label: string;
  repeat?: number;
  profileId?: TemporalProfileId;
}

type RotationRecipeStep = RotationSelectorStep | RotationTransitionStep;

interface ResonatorDpsRegistryEntry {
  defaultScalingAttribute: ScalingAttribute;
  actionOverrides: readonly ActionOverride[];
  rotation: {
    id: string;
    name: string;
    sourceLabel: string;
    steps: readonly RotationRecipeStep[];
  };
}

interface ParsedRegistry {
  version: 1;
  sourcePolicy: string;
  resonators: Readonly<Record<string, ResonatorDpsRegistryEntry>>;
}

const skillTypeSet = new Set<string>(skillTypes);
const damageTypeSet = new Set<string>(damageTypes);
const profileIdSet = new Set<string>(temporalProfileIds);
const scalingAttributeSet = new Set<string>(["attack", "hp", "defense"]);

function fail(message: string): never {
  throw new Error(`Personal DPS roster registry: ${message}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 300): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fail(`${label} must be bounded printable text`);
  }
  return value;
}

function textArray(value: unknown, label: string): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 12) {
    return fail(`${label} must be a bounded string array`);
  }
  return value.map((item, index) => text(item, `${label}[${index}]`, 160));
}

function optionalSourceId(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  const parsed = text(value, label, 160);
  if (!/^[A-Za-z0-9._:-]+$/.test(parsed)) {
    return fail(`${label} contains unsupported characters`);
  }
  return parsed;
}

function optionalTalent(value: unknown, label: string): SkillType | undefined {
  if (value === undefined) return undefined;
  const parsed = text(value, label, 80);
  if (!skillTypeSet.has(parsed)) return fail(`${label} is unsupported`);
  return parsed as SkillType;
}

function optionalDamageType(value: unknown, label: string): DamageType | undefined {
  if (value === undefined) return undefined;
  const parsed = text(value, label, 80);
  if (!damageTypeSet.has(parsed)) return fail(`${label} is unsupported`);
  return parsed as DamageType;
}

function optionalScalingAttribute(
  value: unknown,
  label: string,
): ScalingAttribute | undefined {
  if (value === undefined) return undefined;
  const parsed = text(value, label, 80);
  if (!scalingAttributeSet.has(parsed)) return fail(`${label} is unsupported`);
  return parsed as ScalingAttribute;
}

function optionalProfileId(value: unknown, label: string): TemporalProfileId | undefined {
  if (value === undefined) return undefined;
  const parsed = text(value, label, 80);
  if (!profileIdSet.has(parsed)) return fail(`${label} is unsupported`);
  return parsed as TemporalProfileId;
}

function positiveRepeat(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) <= 0 || (value as number) > 30) {
    return fail(`${label} must be an integer between 1 and 30`);
  }
  return value as number;
}

function parseSelector(value: unknown, label: string): ActionSelector {
  const raw = record(value, label);
  return {
    talent: optionalTalent(raw.talent, `${label}.talent`),
    sourceSkillId: optionalSourceId(raw.sourceSkillId, `${label}.sourceSkillId`),
    sourceAttributeId: optionalSourceId(
      raw.sourceAttributeId,
      `${label}.sourceAttributeId`,
    ),
    nameIncludes: textArray(raw.nameIncludes, `${label}.nameIncludes`),
    nameExcludes: textArray(raw.nameExcludes, `${label}.nameExcludes`),
    sourceSkillNameIncludes: textArray(
      raw.sourceSkillNameIncludes,
      `${label}.sourceSkillNameIncludes`,
    ),
  };
}

function parseRegistry(): ParsedRegistry {
  const root = record(rawRegistry as unknown, "root");
  if (root.version !== 1) fail("version must be 1");
  const sourcePolicy = text(root.sourcePolicy, "sourcePolicy", 1_000);
  const rawResonators = record(root.resonators, "resonators");
  const resonators: Record<string, ResonatorDpsRegistryEntry> = {};

  for (const [resonatorId, rawEntryValue] of Object.entries(rawResonators)) {
    if (!/^[a-z0-9-]{1,100}$/.test(resonatorId)) fail(`invalid resonator id ${resonatorId}`);
    const rawEntry = record(rawEntryValue, `resonators.${resonatorId}`);
    const defaultScalingAttribute = optionalScalingAttribute(
      rawEntry.defaultScalingAttribute,
      `${resonatorId}.defaultScalingAttribute`,
    );
    if (!defaultScalingAttribute) fail(`${resonatorId} needs a default scaling attribute`);

    const rawOverrides = rawEntry.actionOverrides;
    if (!Array.isArray(rawOverrides) || rawOverrides.length > 80) {
      fail(`${resonatorId}.actionOverrides must be a bounded array`);
    }
    const actionOverrides = rawOverrides.map((rawOverride, index) => {
      const overrideRecord = record(rawOverride, `${resonatorId}.actionOverrides[${index}]`);
      const selector = parseSelector(overrideRecord, `${resonatorId}.actionOverrides[${index}]`);
      const damageType = optionalDamageType(
        overrideRecord.damageType,
        `${resonatorId}.actionOverrides[${index}].damageType`,
      );
      const scalingAttribute = optionalScalingAttribute(
        overrideRecord.scalingAttribute,
        `${resonatorId}.actionOverrides[${index}].scalingAttribute`,
      );
      if (!damageType && !scalingAttribute) {
        fail(`${resonatorId}.actionOverrides[${index}] changes nothing`);
      }
      return { ...selector, damageType, scalingAttribute };
    });

    const rawRotation = record(rawEntry.rotation, `${resonatorId}.rotation`);
    const rawSteps = rawRotation.steps;
    if (!Array.isArray(rawSteps) || rawSteps.length === 0 || rawSteps.length > 100) {
      fail(`${resonatorId}.rotation.steps must be a bounded non-empty array`);
    }
    const steps: RotationRecipeStep[] = rawSteps.map((rawStepValue, index) => {
      const rawStep = record(rawStepValue, `${resonatorId}.rotation.steps[${index}]`);
      const repeat = positiveRepeat(rawStep.repeat, `${resonatorId}.rotation.steps[${index}].repeat`);
      const profileId = optionalProfileId(
        rawStep.profileId,
        `${resonatorId}.rotation.steps[${index}].profileId`,
      );
      if (rawStep.selector !== undefined) {
        return {
          selector: parseSelector(
            rawStep.selector,
            `${resonatorId}.rotation.steps[${index}].selector`,
          ),
          repeat,
          profileId,
          allowTalentFallback: rawStep.allowTalentFallback === true,
        };
      }
      return {
        label: text(rawStep.label, `${resonatorId}.rotation.steps[${index}].label`),
        repeat,
        profileId,
      };
    });

    resonators[resonatorId] = {
      defaultScalingAttribute,
      actionOverrides,
      rotation: {
        id: text(rawRotation.id, `${resonatorId}.rotation.id`, 180),
        name: text(rawRotation.name, `${resonatorId}.rotation.name`, 240),
        sourceLabel: text(rawRotation.sourceLabel, `${resonatorId}.rotation.sourceLabel`, 300),
        steps,
      },
    };
  }

  return { version: 1, sourcePolicy, resonators };
}

export const personalDpsRosterRegistry = parseRegistry();

const normalize = (value: string): string =>
  value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

function includesEvery(haystack: string, needles: readonly string[]): boolean {
  const normalizedHaystack = normalize(haystack);
  return needles.every((needle) => normalizedHaystack.includes(normalize(needle)));
}

function matchesSelector(action: ProjectedAction, selector: ActionSelector): boolean {
  if (selector.talent && action.talent !== selector.talent) return false;
  if (selector.sourceSkillId && action.sourceSkillId !== selector.sourceSkillId) return false;
  if (
    selector.sourceAttributeId &&
    action.sourceAttributeId !== selector.sourceAttributeId
  ) {
    return false;
  }
  if (!includesEvery(action.name, selector.nameIncludes)) return false;
  const normalizedName = normalize(action.name);
  if (selector.nameExcludes.some((needle) => normalizedName.includes(normalize(needle)))) {
    return false;
  }
  const sourceSkillName = action.sourceSkillName ?? "";
  return includesEvery(sourceSkillName, selector.sourceSkillNameIncludes);
}

function resonatorEntry(resonatorId: string): ResonatorDpsRegistryEntry | undefined {
  return personalDpsRosterRegistry.resonators[resonatorId];
}

export function materializeProjectedCombatActions(
  resonatorId: string,
  actions: readonly ProjectedAction[],
): readonly ProjectedAction[] {
  const entry = resonatorEntry(resonatorId);
  if (!entry) return actions;
  const matchedOverrideCounts = new Array(entry.actionOverrides.length).fill(0);

  const materialized = actions.map((action) => {
    let result: ProjectedAction = {
      ...action,
      scalingAttribute: entry.defaultScalingAttribute,
    };
    const assigned: Partial<Record<"damageType" | "scalingAttribute", string>> = {};
    entry.actionOverrides.forEach((override, index) => {
      if (!matchesSelector(action, override)) return;
      matchedOverrideCounts[index] += 1;
      if (override.damageType) {
        if (assigned.damageType && assigned.damageType !== override.damageType) {
          fail(`${resonatorId}:${action.id} receives conflicting damageType overrides`);
        }
        assigned.damageType = override.damageType;
        result = { ...result, damageType: override.damageType };
      }
      if (override.scalingAttribute) {
        if (
          assigned.scalingAttribute &&
          assigned.scalingAttribute !== override.scalingAttribute
        ) {
          fail(`${resonatorId}:${action.id} receives conflicting scaling overrides`);
        }
        assigned.scalingAttribute = override.scalingAttribute;
        result = { ...result, scalingAttribute: override.scalingAttribute };
      }
    });
    return result;
  });

  matchedOverrideCounts.forEach((count, index) => {
    if (count === 0) fail(`${resonatorId}.actionOverrides[${index}] matches no projected action`);
  });
  return materialized;
}

function resolveRotationAction(
  resonatorId: string,
  actions: readonly ProjectedAction[],
  step: RotationSelectorStep,
  stepIndex: number,
): ProjectedAction {
  let matches = actions.filter((action) => matchesSelector(action, step.selector));
  if (
    matches.length === 0 &&
    step.allowTalentFallback &&
    step.selector.talent &&
    !step.selector.sourceSkillId &&
    !step.selector.sourceAttributeId
  ) {
    matches = actions.filter((action) => action.talent === step.selector.talent);
  }
  if (matches.length !== 1) {
    const candidates = matches.map((action) => `${action.id}:${action.name}`).join(", ");
    return fail(
      `${resonatorId}.rotation.steps[${stepIndex}] resolves to ${matches.length} actions${candidates ? ` (${candidates})` : ""}`,
    );
  }
  return matches[0];
}

export interface RegistryPersonalRotationScenario {
  id: string;
  resonatorId: string;
  name: string;
  rotation: TheoreticalRotationPreset;
  assumeLegacyRequirementsSatisfied: true;
  notes: readonly string[];
}

export const registryPersonalRotationScenarios: readonly RegistryPersonalRotationScenario[] =
  Object.entries(personalDpsRosterRegistry.resonators).map(([resonatorId, entry]) => {
    const generated = generatedCharacterBoxCombat10R1[
      resonatorId as keyof typeof generatedCharacterBoxCombat10R1
    ];
    if (!generated) return fail(`${resonatorId} has no generated combat projection`);
    const actions = materializeProjectedCombatActions(
      resonatorId,
      generated.actions as unknown as readonly ProjectedAction[],
    );
    const steps: TheoreticalRotationPreset["steps"] = entry.rotation.steps.map(
      (step, stepIndex) => {
        if ("selector" in step) {
          const action = resolveRotationAction(resonatorId, actions, step, stepIndex);
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
      },
    );
    return {
      id: entry.rotation.id,
      resonatorId,
      name: entry.rotation.name,
      rotation: {
        id: entry.rotation.id,
        name: entry.rotation.name,
        steps,
      },
      assumeLegacyRequirementsSatisfied: true,
      notes: [
        entry.rotation.sourceLabel,
        personalDpsRosterRegistry.sourcePolicy,
        "Timing uses the shared WUWA LAB theoretical profiles; exact frame timing is not claimed.",
      ],
    };
  });
