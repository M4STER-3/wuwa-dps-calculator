import type { EffectDefinition } from "@/domain/effect-models";
import type { CombatAction } from "@/domain/models";
import type {
  PersonalRotationScenario,
  RotationSpecialEventPreset,
} from "./personal-rotation-presets";

type ScenarioMechanics = Pick<
  PersonalRotationScenario,
  "initialResources" | "specialEvents" | "extraEffects"
>;

type PreciseAction = CombatAction & {
  readonly sourceAttributeId?: string;
};

const actionId = (resonatorId: string, sourceAttributeId: string): string =>
  `precise-${resonatorId}-attr-${sourceAttributeId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

const constant = (value: number) => ({ kind: "constant" as const, value });
const actionPredicate = (...ids: string[]) => ({
  kind: "identity" as const,
  field: "actionId" as const,
  anyOf: ids,
});
const modePredicate = (...modes: string[]) => ({
  kind: "identity" as const,
  field: "resonanceMode" as const,
  anyOf: modes,
});

const LYNAE = {
  intro: actionId("lynae", "1509029"),
  liberation: actionId("lynae", "1509010"),
  skill: actionId("lynae", "1509006"),
  spark3: actionId("lynae", "1509013"),
  leap1: actionId("lynae", "1509020"),
  leap2: actionId("lynae", "1509021"),
  leap3: actionId("lynae", "1509022"),
  visual: actionId("lynae", "1509009"),
  iridescent: actionId("lynae", "1509008"),
  graffiti: actionId("lynae", "1509024"),
  midairHeavy: actionId("lynae", "1509028"),
  tuneRuptureResponse: actionId("lynae", "1509032"),
} as const;
const lynaeLeaps = [LYNAE.leap1, LYNAE.leap2, LYNAE.leap3] as const;
const lynaeFluxActions = [LYNAE.intro, ...lynaeLeaps, LYNAE.visual, LYNAE.iridescent] as const;

const lynaeStateMachine: EffectDefinition = {
  id: "precise-lynae-state-machine",
  label: "Lynae · Optical Sampling / Kaleidoscopic Parade",
  source: { id: "lynae", type: "resonator", label: "Lynae Forte Circuit" },
  target: "self",
  rules: [],
  triggers: [
    {
      id: "lynae-enter-kaleidoscopic-parade",
      event: "action-end",
      predicates: [actionPredicate(LYNAE.spark3)],
      operations: [{ kind: "change-form", stateId: "Kaleidoscopic Parade" }],
    },
    {
      id: "lynae-leave-kaleidoscopic-parade",
      event: "outro",
      operations: [
        { kind: "change-form", stateId: "Optical Sampling Stage" },
        { kind: "resource", operation: "consume-all", resourceId: "overflow" },
        { kind: "resource", operation: "consume-all", resourceId: "lumiflow" },
        { kind: "resource", operation: "consume-all", resourceId: "true-color" },
      ],
    },
  ],
};

const lynaeAdaptiveOptics: EffectDefinition = {
  id: "precise-lynae-adaptive-optics",
  label: "Adaptive Optics · +25% Spectro DMG",
  source: { id: "lynae-adaptive-optics", type: "resonator", label: "Adaptive Optics: Everyday Applications" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 9 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "adaptive-optics-spectro",
      label: "+25% Spectro DMG for 9s after Intro",
      accounting: "runtime",
      selectors: [{ kind: "element", anyOf: ["spectro"] }],
      modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 25 }],
    },
  ],
  triggers: [
    {
      id: "adaptive-optics-on-intro",
      event: "action-start",
      predicates: [actionPredicate(LYNAE.intro)],
      operations: [{ kind: "activate-effect", effectId: "precise-lynae-adaptive-optics" }],
    },
  ],
};

const lynaeLiberationBuff: EffectDefinition = {
  id: "precise-lynae-prismatic-overblast-buff",
  label: "Prismatic Overblast · +24% All DMG",
  source: { id: "lynae-prismatic-overblast", type: "resonator", label: "Prismatic Overblast" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "prismatic-overblast-all-dmg",
      label: "+24% All DMG for 30s",
      accounting: "runtime",
      modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 24 }],
    },
  ],
  triggers: [
    {
      id: "prismatic-overblast-buff-on-cast",
      event: "action-start",
      predicates: [actionPredicate(LYNAE.liberation)],
      operations: [{ kind: "activate-effect", effectId: "precise-lynae-prismatic-overblast-buff" }],
    },
  ],
};

const lynaeVisualImpactBuff: EffectDefinition = {
  id: "precise-lynae-visual-impact-buff",
  label: "Visual Impact · +40 Tune Break Boost",
  source: { id: "lynae-visual-impact", type: "resonator", label: "Visual Impact" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "visual-impact-tune-break-boost",
      label: "+40 Tune Break Boost for 30s",
      accounting: "runtime",
      modifiers: [
        {
          kind: "runtime-stat",
          stat: "tuneBreakBoost",
          mode: "flat",
          stacking: "additive",
          value: constant(40),
        },
      ],
    },
  ],
  triggers: [
    {
      id: "visual-impact-buff-on-cast",
      event: "action-start",
      predicates: [actionPredicate(LYNAE.visual)],
      operations: [{ kind: "activate-effect", effectId: "precise-lynae-visual-impact-buff" }],
    },
  ],
};

const lynaeSequences: EffectDefinition = {
  id: "precise-lynae-sequences",
  label: "Lynae Resonance Chain · personal damage",
  source: { id: "lynae-chain", type: "resonance-chain", label: "Lynae Resonance Chain" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [
    {
      id: "lynae-s1-polychrome-leap",
      label: "S1 · Polychrome Leap multiplier +120%",
      accounting: "runtime",
      requiredSequence: 1,
      selectors: [{ kind: "action-id", anyOf: lynaeLeaps }],
      modifiers: [
        { kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(120) },
      ],
    },
    {
      id: "lynae-s2-self-amplification",
      label: "S2 · +25% All-DMG Amplification",
      accounting: "runtime",
      requiredSequence: 2,
      modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 25 }],
    },
    {
      id: "lynae-s3-visual-impact",
      label: "S3 · Visual Impact / Iridescent Splash multiplier +90%",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: [LYNAE.visual, LYNAE.iridescent] }],
      modifiers: [
        { kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(90) },
      ],
    },
    {
      id: "lynae-s5-prismatic-overblast",
      label: "S5 · Prismatic Overblast multiplier +70%",
      accounting: "runtime",
      requiredSequence: 5,
      selectors: [{ kind: "action-id", anyOf: [LYNAE.liberation] }],
      modifiers: [
        { kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(70) },
      ],
    },
  ],
};

const lynaeColorOfSoul: EffectDefinition = {
  id: "precise-lynae-color-of-soul",
  label: "S6 · Color of Soul",
  source: { id: "lynae-s6", type: "resonance-chain", label: "Lynae S6 · Color of Soul" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: {
    duration: { kind: "indefinite" },
    uniqueness: "replace-existing",
    stacks: { kind: "shared", max: 3, initial: 0 },
  },
  rules: [
    {
      id: "lynae-s6-color-of-soul-damage",
      label: "S6 · +30% Polychrome/Visual DMG per Color of Soul",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [{ kind: "action-id", anyOf: [...lynaeLeaps, LYNAE.visual] }],
      modifiers: [
        {
          kind: "motion-value",
          mode: "relative-additive",
          stacking: "additive",
          value: { kind: "multiply", values: [{ kind: "stacks" }, constant(30)] },
        },
      ],
    },
  ],
  triggers: [
    {
      id: "lynae-s6-color-of-soul-gain",
      event: "action-end",
      predicates: [actionPredicate(LYNAE.graffiti, LYNAE.midairHeavy)],
      operations: [
        { kind: "gain-stacks", effectId: "precise-lynae-color-of-soul", amount: constant(1) },
      ],
    },
    {
      id: "lynae-s6-color-of-soul-consume",
      event: "action-end",
      predicates: [actionPredicate(...lynaeLeaps, LYNAE.visual)],
      operations: [{ kind: "clear-stacks", effectId: "precise-lynae-color-of-soul" }],
    },
  ],
};

const lynaePhotochromicFlux: EffectDefinition = {
  id: "precise-lynae-photochromic-flux",
  label: "Photochromic Flux / Shifting",
  source: { id: "lynae-photochromic-flux", type: "resonator", label: "Photochromic Flux" },
  target: "enemy",
  rules: [],
  statuses: [
    { id: "tune-rupture-shifting", label: "Tune Rupture - Shifting", maxStacks: 1, durationSeconds: 25 },
    { id: "tune-strain-shifting", label: "Tune Strain - Shifting", maxStacks: 1, durationSeconds: 25 },
  ],
  triggers: [
    {
      id: "lynae-photochromic-rupture",
      event: "action-end",
      predicates: [actionPredicate(...lynaeFluxActions), modePredicate("tune-rupture")],
      operations: [{ kind: "apply-status", statusId: "tune-rupture-shifting", stacks: constant(1) }],
    },
    {
      id: "lynae-photochromic-strain",
      event: "action-end",
      predicates: [actionPredicate(...lynaeFluxActions), modePredicate("tune-strain")],
      operations: [{ kind: "apply-status", statusId: "tune-strain-shifting", stacks: constant(1) }],
    },
    {
      id: "lynae-tune-rupture-response",
      event: "tune-rupture",
      externalContextRequired: true,
      predicates: [{ kind: "target-has-status", id: "tune-rupture-shifting" }],
      cooldown: { seconds: 8, scope: "target" },
      operations: [
        {
          kind: "emit-action",
          action: {
            actionId: LYNAE.tuneRuptureResponse,
            attribution: "tune",
            snapshot: { stats: "hit", stacks: "tick" },
          },
        },
      ],
    },
  ],
};

const lynaeTuneStrainPending: EffectDefinition = {
  id: "precise-lynae-tune-strain-team-context",
  label: "Tune Strain response · team-context pending",
  source: { id: "lynae-tune-strain", type: "resonator", label: "Spectral Analysis · Tune Strain response" },
  target: "self",
  teamContextRequired: true,
  rules: [
    {
      id: "lynae-tune-strain-formula-pending",
      label: "Interfered stacks × Tune Break Boost × 0.12%",
      accounting: "informational",
      selectors: [{ kind: "resonance-mode", anyOf: ["tune-strain"] }],
      modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 0 }],
    },
  ],
};

const MORN = {
  intro: actionId("mornye", "1209025"),
  geopotential: actionId("mornye", "1209029"),
  distributedArray: actionId("mornye", "1209017"),
  inversion: actionId("mornye", "1209030"),
  liberation: actionId("mornye", "1209021"),
  syntonyField: actionId("mornye", "1209028"),
  particleJet: actionId("mornye", "1209031"),
} as const;

const mornyeStateMachine: EffectDefinition = {
  id: "precise-mornye-state-machine",
  label: "Mornye · Baseline / Wide Field Observation",
  source: { id: "mornye", type: "resonator", label: "Mass-Energy Equivalence" },
  target: "self",
  rules: [],
  triggers: [
    {
      id: "mornye-enter-wide-field",
      event: "action-end",
      predicates: [actionPredicate(MORN.geopotential, MORN.intro)],
      operations: [
        { kind: "change-form", stateId: "Wide Field Observation Mode" },
        { kind: "resource", operation: "consume-all", resourceId: "rest-mass-energy" },
        {
          kind: "emit-action",
          action: {
            actionId: MORN.syntonyField,
            attribution: "follow-up",
            delaySeconds: 0.0001,
            snapshot: { stats: "trigger", stacks: "trigger" },
          },
        },
        { kind: "activate-effect", effectId: "precise-mornye-syntony-field" },
      ],
    },
    {
      id: "mornye-exit-wide-field",
      event: "outro",
      operations: [
        { kind: "change-form", stateId: "Baseline Mode" },
        { kind: "resource", operation: "consume-all", resourceId: "relative-momentum" },
      ],
    },
  ],
};

const mornyeSyntonyField: EffectDefinition = {
  id: "precise-mornye-syntony-field",
  label: "Syntony Field",
  source: { id: "mornye-syntony-field", type: "resonator", label: "Syntony Field" },
  target: "team",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 25 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
    endOnSwitchOut: "owner",
  },
  rules: [],
};

const mornyeCriticalProtocol: EffectDefinition = {
  id: "precise-mornye-critical-protocol",
  label: "Critical Protocol · ER-scaled Crit",
  source: { id: "mornye-critical-protocol", type: "resonator", label: "Critical Protocol" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [
    {
      id: "mornye-critical-protocol-er-crit",
      label: "Excess ER grants up to +80% Crit Rate / +160% Crit DMG",
      accounting: "runtime",
      selectors: [{ kind: "action-id", anyOf: [MORN.liberation] }],
      modifiers: [
        {
          kind: "runtime-stat",
          stat: "critRate",
          mode: "flat",
          stacking: "additive",
          value: {
            kind: "clamp",
            min: 0,
            max: 80,
            value: {
              kind: "multiply",
              values: [
                { kind: "subtract", left: { kind: "stat", stat: "energyRegen" }, right: constant(100) },
                constant(0.5),
              ],
            },
          },
        },
        {
          kind: "runtime-stat",
          stat: "critDamage",
          mode: "flat",
          stacking: "additive",
          value: {
            kind: "clamp",
            min: 0,
            max: 160,
            value: { kind: "subtract", left: { kind: "stat", stat: "energyRegen" }, right: constant(100) },
          },
        },
      ],
    },
    {
      id: "mornye-s5-critical-protocol",
      label: "S5 · Critical Protocol multiplier +40%",
      accounting: "runtime",
      requiredSequence: 5,
      selectors: [{ kind: "action-id", anyOf: [MORN.liberation] }],
      modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(40) }],
    },
    {
      id: "mornye-s5-particle-jet",
      label: "S5 · Particle Jet multiplier +160%",
      accounting: "runtime",
      requiredSequence: 5,
      selectors: [{ kind: "action-id", anyOf: [MORN.particleJet] }],
      modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(160) }],
    },
    {
      id: "mornye-s6-critical-protocol",
      label: "S6 · Critical Protocol deals +400% DMG",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [{ kind: "action-id", anyOf: [MORN.liberation] }],
      modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(400) }],
    },
  ],
};

const mornyeMarkers: EffectDefinition = {
  id: "precise-mornye-markers",
  label: "Observation / Interfered Marker",
  source: { id: "mornye-markers", type: "resonator", label: "Mass-Energy Equivalence · markers" },
  target: "enemy",
  rules: [
    {
      id: "mornye-s2-interfered-crit-dmg",
      label: "S2 · excess ER grants up to +32% Crit DMG vs Interfered Marker",
      accounting: "runtime",
      requiredSequence: 2,
      predicates: [
        {
          kind: "or",
          predicates: [
            { kind: "target-has-status", id: "mornye-interfered-marker" },
            { kind: "target-has-status", id: "mornye-interfered-marker-s1" },
          ],
        },
      ],
      modifiers: [
        {
          kind: "runtime-stat",
          stat: "critDamage",
          mode: "flat",
          stacking: "additive",
          value: {
            kind: "clamp",
            min: 0,
            max: 32,
            value: {
              kind: "multiply",
              values: [
                { kind: "subtract", left: { kind: "stat", stat: "energyRegen" }, right: constant(100) },
                constant(0.2),
              ],
            },
          },
        },
      ],
    },
  ],
  statuses: [
    { id: "mornye-observation-marker", label: "Observation Marker", maxStacks: 1, durationSeconds: 30 },
    { id: "mornye-interfered-marker", label: "Interfered Marker", maxStacks: 1, durationSeconds: 8 },
    { id: "mornye-interfered-marker-s1", label: "Interfered Marker · S1", maxStacks: 1, durationSeconds: 20 },
  ],
  triggers: [
    {
      id: "mornye-observation-on-inversion",
      event: "action-end",
      predicates: [actionPredicate(MORN.inversion)],
      operations: [{ kind: "apply-status", statusId: "mornye-observation-marker", stacks: constant(1) }],
    },
    {
      id: "mornye-observation-to-interfered",
      event: "tune-break",
      externalContextRequired: true,
      predicates: [{ kind: "target-has-status", id: "mornye-observation-marker" }],
      operations: [{ kind: "apply-status", statusId: "mornye-interfered-marker", stacks: constant(1) }],
    },
    {
      id: "mornye-s1-immediate-interfered",
      event: "custom",
      predicates: [actionPredicate("mornye-s1-interfered-marker")],
      operations: [{ kind: "apply-status", statusId: "mornye-interfered-marker-s1", stacks: constant(1) }],
    },
    {
      id: "mornye-s3-relative-momentum",
      event: "custom",
      predicates: [actionPredicate("mornye-s3-relative-momentum")],
      operations: [{ kind: "resource", operation: "set-max", resourceId: "relative-momentum" }],
    },
  ],
};

const mornyeInterferedDamagePending: EffectDefinition = {
  id: "precise-mornye-interfered-damage-team-context",
  label: "Interfered Marker damage increase · team-context pending",
  source: { id: "mornye-interfered-damage", type: "resonator", label: "Interfered Marker" },
  target: "enemy",
  teamContextRequired: true,
  rules: [
    {
      id: "mornye-interfered-er-damage-formula-pending",
      label: "Excess ER × 0.25%, capped at 40%",
      accounting: "informational",
      modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 0 }],
    },
  ],
};

export function applyPreciseSpecialActionPatches(
  resonatorId: string,
  actions: readonly PreciseAction[],
): readonly PreciseAction[] {
  if (resonatorId !== "lynae") return actions;
  return actions.map((action) => {
    switch (action.sourceAttributeId) {
      case "1509029":
        return {
          ...action,
          resourceOperations: [{ resourceId: "overflow", operation: "gain", amount: 100, stage: "after-action" }],
        };
      case "1509006":
        return {
          ...action,
          resourceOperations: [{ resourceId: "overflow", operation: "gain", amount: 20, stage: "after-action" }],
        };
      case "1509013":
        return {
          ...action,
          resourceOperations: [
            { resourceId: "overflow", operation: "consume", amount: 120, stage: "before-action" },
            { resourceId: "lumiflow", operation: "gain", amount: 120, stage: "after-action" },
          ],
        };
      case "1509020":
      case "1509021":
      case "1509022":
        return {
          ...action,
          resourceOperations: [
            { resourceId: "lumiflow", operation: "consume", amount: 40, stage: "before-action" },
            { resourceId: "true-color", operation: "gain", amount: 1, stage: "after-action" },
          ],
        };
      case "1509009":
      case "1509008":
        return {
          ...action,
          resourceOperations: [{ resourceId: "true-color", operation: "consume", amount: 3, stage: "before-action" }],
        };
      default:
        return action;
    }
  });
}

const lynaeEffects: readonly EffectDefinition[] = [
  lynaeStateMachine,
  lynaeAdaptiveOptics,
  lynaeLiberationBuff,
  lynaeVisualImpactBuff,
  lynaeSequences,
  lynaeColorOfSoul,
  lynaePhotochromicFlux,
  lynaeTuneStrainPending,
];
const mornyeEffects: readonly EffectDefinition[] = [
  mornyeStateMachine,
  mornyeSyntonyField,
  mornyeCriticalProtocol,
  mornyeMarkers,
  mornyeInterferedDamagePending,
];

const outroEvent = (stepIndex: number, maximumSequence?: 5): RotationSpecialEventPreset => ({
  id: "outro-state-exit",
  kind: "outro",
  anchor: { stepIndex, at: "start" },
  ...(maximumSequence === undefined ? {} : { maximumSequence }),
});

const mornyeSequenceEvents = (
  inversionStep: number,
  distributedArrayStep: number,
): readonly RotationSpecialEventPreset[] => [
  {
    id: "mornye-s1-immediate-interfered",
    kind: "custom",
    actionId: "mornye-s1-interfered-marker",
    anchor: { stepIndex: inversionStep, at: "end", offsetSeconds: 0.0001 },
    minimumSequence: 1,
  },
  {
    id: "mornye-s3-relative-momentum",
    kind: "custom",
    actionId: "mornye-s3-relative-momentum",
    anchor: { stepIndex: distributedArrayStep, at: "end", offsetSeconds: 0.0001 },
    minimumSequence: 3,
  },
];

export function preciseScenarioMechanicsFor(scenarioId: string): ScenarioMechanics | undefined {
  if (scenarioId === "lynae-tune-rupture" || scenarioId === "lynae-tune-strain") {
    return {
      initialResources: { overflow: 0, lumiflow: 0, "true-color": 0 },
      specialEvents: [outroEvent(8, 5)],
      extraEffects: lynaeEffects,
    };
  }
  if (scenarioId === "mornye-opener") {
    return {
      initialResources: { "rest-mass-energy": 0, "relative-momentum": 0 },
      specialEvents: [...mornyeSequenceEvents(8, 7), outroEvent(10)],
      extraEffects: mornyeEffects,
    };
  }
  if (scenarioId === "mornye-loop") {
    return {
      initialResources: { "rest-mass-energy": 0, "relative-momentum": 0 },
      specialEvents: [...mornyeSequenceEvents(5, 4), outroEvent(7)],
      extraEffects: mornyeEffects,
    };
  }
  if (scenarioId === "mornye-loop-forte-skip") {
    return {
      initialResources: { "rest-mass-energy": 0, "relative-momentum": 0 },
      specialEvents: [...mornyeSequenceEvents(4, 5), outroEvent(6)],
      extraEffects: mornyeEffects,
    };
  }
  return undefined;
}
