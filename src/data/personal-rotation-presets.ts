import type { CombatEventKind, EffectDefinition } from "@/domain/effect-models";
import type { CombatAction, Sequence } from "@/domain/models";
import type { TheoreticalRotationPreset } from "@/domain/theoretical-rotation";

export interface RotationEventAnchor {
  stepIndex: number;
  at: "start" | "end";
  offsetSeconds?: number;
}

export interface SequencePayloadOverride {
  minimumSequence: Sequence;
  payload?: Readonly<Record<string, unknown>>;
  payloadByRepeat?: readonly Readonly<Record<string, unknown>>[];
}

export interface RotationSpecialEventPreset {
  id: string;
  kind: CombatEventKind;
  actionId?: string;
  anchor: RotationEventAnchor;
  repeat?: number;
  minimumSequence?: Sequence;
  maximumSequence?: Sequence;
  payload?: Readonly<Record<string, unknown>>;
  payloadByRepeat?: readonly Readonly<Record<string, unknown>>[];
  sequenceOverrides?: readonly SequencePayloadOverride[];
}

export interface PersonalRotationScenario {
  id: string;
  resonatorId: string;
  name: string;
  resonanceMode?: string;
  rotation: TheoreticalRotationPreset;
  /** Full-resource theoretical windows are declared here, never inferred by the engine. */
  initialResources?: Readonly<Record<string, number>>;
  /** A recommended scenario may assert legacy textual conditions that lack structured runtime gates. */
  assumeLegacyRequirementsSatisfied?: boolean;
  specialEvents?: readonly RotationSpecialEventPreset[];
  extraEffects?: readonly EffectDefinition[];
  /** Formula-only virtual actions are data, not character branches in the runner. */
  extraActions?: readonly CombatAction[];
  notes: readonly string[];
}

const scenarioSource = {
  kind: "community-calculation" as const,
  source: "WUWA LAB theoretical rotation scenario",
  notes: "Scenario-owned assumption; formula data remains independent.",
};
const unknown = () => ({ value: null, confidence: "unknown" as const });
const virtualAction = (id: string, name: string): CombatAction => ({
  id,
  name,
  talent: "forteCircuit",
  level: 10,
  multipliers: [],
  castDurationSeconds: unknown(),
  recoverySeconds: unknown(),
  hitTimingsSeconds: unknown(),
  source: scenarioSource,
});

const aemeathSteps: TheoreticalRotationPreset["steps"] = [
  { actionId: "intro-mech" },
  { actionId: "mech-basic-3" },
  { actionId: "mech-basic-4" },
  { actionId: "overdrive" },
  { actionId: "mech-basic-2" },
  { actionId: "mech-basic-3" },
  { actionId: "mech-basic-4" },
  { label: "Mode reaction / status window", profileId: "very-short" },
  { actionId: "seraphic-encore" },
  { actionId: "aemeath-basic-2" },
  { actionId: "aemeath-basic-3" },
  { actionId: "aemeath-basic-4" },
  { actionId: "seraphic-overture" },
  { actionId: "mech-heavy-2" },
  { actionId: "finale" },
  { actionId: "sigillum-skill" },
  { label: "Outro / handoff", profileId: "outro" },
];

const aemeathModeApplications = (kind: "tune-rupture" | "fusion-burst") => [
  ...[0, 1, 2, 5, 6, 10, 11].map((stepIndex, index) => ({
    id: `aemeath-${kind}-application-${index}`,
    kind,
    anchor: { stepIndex, at: "end" as const, offsetSeconds: 0.001 },
    payload: { noDamage: true, applicationOnly: true },
  })),
  {
    id: `aemeath-${kind}-s3-heavy-application`,
    kind,
    anchor: { stepIndex: 13, at: "end" as const, offsetSeconds: 0.001 },
    minimumSequence: 3 as const,
    payload: { noDamage: true, applicationOnly: true, source: "s3-instant-response-heavy-ii" },
  },
];

const aemeathInstantResponseScenario: EffectDefinition = {
  id: "scenario-aemeath-instant-response-heavy",
  label: "Scenario: Aemeath Instant Response Heavy",
  source: { id: "scenario-aemeath", type: "system", label: "Aemeath theoretical rotation" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 2 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "instant-response-heavy-amplification",
      label: "Before All Sounds · +200% Heavy DMG Amplification",
      accounting: "runtime",
      selectors: [{ kind: "action-id", anyOf: ["mech-heavy-2", "aemeath-heavy-2"] }],
      modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 200 }],
    },
    {
      id: "instant-response-s1-heavy-crit",
      label: "S1 · +300% Heavy Crit DMG",
      accounting: "runtime",
      requiredSequence: 1,
      selectors: [{ kind: "action-id", anyOf: ["mech-heavy-2", "aemeath-heavy-2"] }],
      modifiers: [{ kind: "crit-damage-bonus", stacking: "additive", value: 300 }],
    },
  ],
  triggers: [
    {
      id: "instant-response-heavy-window",
      event: "action-start",
      predicates: [
        { kind: "identity", field: "actionId", anyOf: ["mech-heavy-2", "aemeath-heavy-2"] },
      ],
      operations: [{ kind: "activate-effect", effectId: "scenario-aemeath-instant-response-heavy" }],
    },
  ],
};

const tuneTrailEffect = (
  id: string,
  triggerActionId: string,
  baseRelativePercent: number,
  s6ExtraRelativePercent: number,
): EffectDefinition => ({
  id,
  label: `${id} Rupturous Trail multiplier`,
  source: { id: "scenario-aemeath-tune", type: "system", label: "Aemeath Tune scenario" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 2.5 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: `${id}-base`,
      label: `Rupturous Trail +${baseRelativePercent}% MV`,
      accounting: "runtime",
      selectors: [{ kind: "action-id", anyOf: ["seraphic-bonus"] }],
      modifiers: [
        {
          kind: "motion-value",
          mode: "relative-additive",
          stacking: "additive",
          value: { kind: "constant", value: baseRelativePercent },
        },
      ],
    },
    {
      id: `${id}-s6-extra`,
      label: `S6 doubled Trail +${s6ExtraRelativePercent}% MV`,
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [{ kind: "action-id", anyOf: ["seraphic-bonus"] }],
      modifiers: [
        {
          kind: "motion-value",
          mode: "relative-additive",
          stacking: "additive",
          value: { kind: "constant", value: s6ExtraRelativePercent },
        },
      ],
    },
  ],
  triggers: [
    {
      id: `${id}-activate`,
      event: "action-end",
      predicates: [{ kind: "identity", field: "actionId", anyOf: [triggerActionId] }],
      operations: [{ kind: "activate-effect", effectId: id }],
    },
  ],
});

const aemeathTuneS2Progressive: EffectDefinition = {
  id: "scenario-aemeath-tune-s2-progressive",
  label: "Aemeath S2 progressive Seraphic Tune multiplier",
  source: { id: "scenario-aemeath-tune", type: "system", label: "Aemeath Tune scenario" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 1 },
    uniqueness: "refresh-existing",
    stacks: { kind: "shared", max: 5, initial: 0 },
  },
  rules: [
    {
      id: "aemeath-s2-progressive-multiplier",
      label: "+20% multiplicative MV per previous Seraphic Tune instance",
      accounting: "runtime",
      requiredSequence: 2,
      selectors: [{ kind: "action-id", anyOf: ["seraphic-bonus"] }],
      modifiers: [
        {
          kind: "motion-value",
          mode: "multiplier",
          stacking: "override",
          value: {
            kind: "add",
            values: [
              { kind: "constant", value: 100 },
              {
                kind: "multiply",
                values: [{ kind: "stacks" }, { kind: "constant", value: 20 }],
              },
            ],
          },
        },
      ],
    },
  ],
  triggers: [
    {
      id: "aemeath-s2-reset-on-seraphic",
      event: "action-end",
      predicates: [
        { kind: "identity", field: "actionId", anyOf: ["seraphic-encore", "seraphic-overture"] },
      ],
      operations: [
        { kind: "expire-effect", effectId: "scenario-aemeath-tune-s2-progressive" },
        { kind: "activate-effect", effectId: "scenario-aemeath-tune-s2-progressive" },
      ],
    },
    {
      id: "aemeath-s2-gain-after-instance",
      event: "damage-dealt",
      predicates: [{ kind: "identity", field: "actionId", anyOf: ["seraphic-bonus"] }],
      operations: [
        {
          kind: "gain-stacks",
          effectId: "scenario-aemeath-tune-s2-progressive",
          amount: { kind: "constant", value: 1 },
        },
      ],
    },
  ],
};

const aemeathTune: PersonalRotationScenario = {
  id: "aemeath-tune-theoretical-v1",
  resonatorId: "aemeath",
  name: "Aemeath · Tune Rupture · theoretical personal loop",
  resonanceMode: "tune-rupture",
  rotation: { id: "aemeath-tune-theoretical-v1", name: "Aemeath Tune Rupture", steps: aemeathSteps },
  assumeLegacyRequirementsSatisfied: true,
  extraActions: [virtualAction("aemeath-tune-break", "Tune Break")],
  extraEffects: [
    aemeathInstantResponseScenario,
    tuneTrailEffect("scenario-aemeath-tune-encore-trail", "seraphic-encore", 120, 120),
    tuneTrailEffect("scenario-aemeath-tune-overture-trail", "seraphic-overture", 80, 120),
    aemeathTuneS2Progressive,
  ],
  specialEvents: [
    ...aemeathModeApplications("tune-rupture"),
    {
      id: "aemeath-tune-break",
      kind: "tune-break",
      actionId: "aemeath-tune-break",
      anchor: { stepIndex: 7, at: "end", offsetSeconds: 0.002 },
    },
    {
      id: "aemeath-starburst",
      kind: "tune-rupture",
      actionId: "starburst",
      anchor: { stepIndex: 7, at: "end", offsetSeconds: 0.003 },
    },
    {
      id: "aemeath-seraphic-encore-bonus",
      kind: "tune-rupture",
      actionId: "seraphic-bonus",
      repeat: 10,
      anchor: { stepIndex: 8, at: "end", offsetSeconds: 0.002 },
    },
    {
      id: "aemeath-seraphic-overture-bonus",
      kind: "tune-rupture",
      actionId: "seraphic-bonus",
      repeat: 10,
      anchor: { stepIndex: 12, at: "end", offsetSeconds: 0.002 },
    },
  ],
  notes: [
    "All durations and hit positions use the shared WUWA LAB theoretical timing profiles.",
    "Rupturous Trail uses a deterministic single-target personal scenario: 30 removed before Encore and 20 before Overture at S0-S5; S6 uses the doubled/cap-60 rules plus the verified Seraphic application.",
    "Stardust Resonance uses 10 Seraphic Tune Rupture instances per enhanced Seraphic cast. S2 stacks are driven by damage events and use a separate MV multiplier layer.",
    "At S3+, Instant Response Charged II emits the current mode application after the Heavy, matching the Sequence replacement without assuming hit timing.",
  ],
};

const aemeathFusion: PersonalRotationScenario = {
  id: "aemeath-fusion-theoretical-v1",
  resonatorId: "aemeath",
  name: "Aemeath · Fusion Burst · theoretical personal loop",
  resonanceMode: "fusion-burst",
  rotation: { id: "aemeath-fusion-theoretical-v1", name: "Aemeath Fusion Burst", steps: aemeathSteps },
  assumeLegacyRequirementsSatisfied: true,
  extraEffects: [aemeathInstantResponseScenario],
  specialEvents: [
    ...aemeathModeApplications("fusion-burst"),
    {
      id: "aemeath-fusion-seraphic-encore",
      kind: "fusion-burst",
      actionId: "aemeath-fusion-burst",
      anchor: { stepIndex: 8, at: "end", offsetSeconds: 0.002 },
      payload: { stacks: 10, multiplierIncreasePercent: 250 },
      sequenceOverrides: [
        { minimumSequence: 2, payload: { multiplierIncreasePercent: 475 } },
        { minimumSequence: 6, payload: { multiplierIncreasePercent: 700 } },
      ],
    },
    {
      id: "aemeath-fusion-auto-threshold",
      kind: "fusion-burst",
      actionId: "aemeath-fusion-burst",
      anchor: { stepIndex: 10, at: "end", offsetSeconds: 0.002 },
      payload: { stacks: 10, multiplierIncreasePercent: 0 },
    },
    {
      id: "aemeath-fusion-seraphic-overture",
      kind: "fusion-burst",
      actionId: "aemeath-fusion-burst",
      anchor: { stepIndex: 12, at: "end", offsetSeconds: 0.002 },
      payload: { stacks: 10, multiplierIncreasePercent: 220 },
      sequenceOverrides: [
        { minimumSequence: 2, payload: { multiplierIncreasePercent: 430 } },
        { minimumSequence: 6, payload: { multiplierIncreasePercent: 610 } },
      ],
    },
  ],
  notes: [
    "Fusion Burst application events refresh Aemeath weapon/Sonata windows without falsely adding damage for each stack application.",
    "The deterministic personal scenario starts from zero Fusion Burst stacks: five eligible applications before Encore, then the >5 automatic threshold after the next eligible application. Seraphic-triggered Burst uses the normal max-stack value 10.",
    "Fusion Trail removal multipliers are data-owned in the event payloads; S2 and S6 overrides do not branch inside the engine.",
    "At S3+, Instant Response Charged II emits Fusion Burst as an application-only event before Finale, as specified by the Sequence node.",
  ],
};

const calcharo: PersonalRotationScenario = {
  id: "calcharo-theoretical-v1",
  resonatorId: "calcharo",
  name: "Calcharo · full burst theoretical loop",
  rotation: {
    id: "calcharo-theoretical-v1",
    name: "Calcharo full burst",
    steps: [
      { actionId: "calcharo-intro" },
      { actionId: "calcharo-skill-1" },
      { actionId: "calcharo-skill-2" },
      { actionId: "calcharo-skill-3" },
      { actionId: "calcharo-mercy" },
      { actionId: "nightmare-thundering-mephis" },
      { actionId: "calcharo-liberation" },
      { actionId: "calcharo-hounds-1" },
      { actionId: "calcharo-hounds-2" },
      { actionId: "calcharo-hounds-3" },
      { actionId: "calcharo-hounds-4" },
      { actionId: "calcharo-hounds-5" },
      { actionId: "calcharo-death-messenger" },
      { actionId: "calcharo-hounds-1" },
      { actionId: "calcharo-hounds-2" },
      { actionId: "calcharo-hounds-3" },
      { actionId: "calcharo-hounds-4" },
      { actionId: "calcharo-hounds-5" },
      { actionId: "calcharo-death-messenger" },
      { actionId: "calcharo-hounds-1" },
      { actionId: "calcharo-hounds-2" },
      { actionId: "calcharo-hounds-3" },
      { actionId: "calcharo-hounds-4" },
      { actionId: "calcharo-hounds-5" },
      { actionId: "calcharo-death-messenger" },
      { label: "Outro / handoff", profileId: "outro" },
    ],
  },
  initialResources: { "resonance-energy": 125 },
  assumeLegacyRequirementsSatisfied: true,
  notes: [
    "Skill 1→2→3 + Mercy is kept as the theoretical warm-up so personal passives, Lustrous Razor and Void Thunder are not skipped.",
    "The Deathblade window uses three five-stage Hounds Roar chains, each followed by Death Messenger; all timings use shared theoretical profiles.",
  ],
};

const chisa: PersonalRotationScenario = {
  id: "chisa-theoretical-v1",
  resonatorId: "chisa",
  name: "Chisa · full Ring Chainsaw theoretical loop",
  rotation: {
    id: "chisa-theoretical-v1",
    name: "Chisa full Ring Chainsaw",
    steps: [
      { actionId: "chisa-intro" },
      { actionId: "chisa-moment-of-nihility" },
      { actionId: "threnodian-horizon" },
      { actionId: "chisa-serrated-loop" },
      { actionId: "chisa-sawring-blitz-1" },
      { actionId: "chisa-sawring-blitz-2-hold" },
      { actionId: "chisa-sawring-blitz-3" },
      { actionId: "chisa-sawring-eradication" },
      { label: "Outro / handoff", profileId: "outro" },
    ],
  },
  initialResources: {
    "ring-of-chainsaw": 100,
    "chainsaw-fever": 100,
    "lifethread-jetstream": 100,
    "resonance-energy": 125,
  },
  assumeLegacyRequirementsSatisfied: true,
  specialEvents: [
    {
      id: "chisa-s1-fixed-snare-damage",
      kind: "custom",
      actionId: "chisa-s1-fixed-snare-damage",
      anchor: { stepIndex: 3, at: "end", offsetSeconds: 0.002 },
      minimumSequence: 1,
      payload: { fixedDamageAmount: 61803, fixedDamageType: "basicAttack" },
    },
  ],
  notes: [
    "This is a full-Ring personal damage window, so Ring starts at 100 instead of inventing unknown per-hit generation values.",
    "Moment of Nihility precedes Chainsaw attacks so Woven Myriad and All Ends Here are represented by their runtime triggers.",
    "Serrated Loop applies Unseen Snare in the full-Ring scenario. S1 fixed Snare damage is emitted only for S1+ and once per target.",
  ],
};

const verina: PersonalRotationScenario = {
  id: "verina-theoretical-v1",
  resonatorId: "verina",
  name: "Verina · support personal theoretical loop",
  rotation: {
    id: "verina-theoretical-v1",
    name: "Verina support loop",
    steps: [
      { actionId: "verina-intro" },
      { actionId: "fallacy-blast" },
      { actionId: "verina-botany-experiment" },
      { actionId: "verina-arboreal-flourish" },
      { actionId: "verina-starflower-heavy" },
      { actionId: "verina-basic-1" },
      { actionId: "verina-basic-2" },
      { actionId: "verina-basic-3" },
      { label: "Outro / handoff", profileId: "outro" },
    ],
  },
  initialResources: { "resonance-energy": 175 },
  assumeLegacyRequirementsSatisfied: true,
  notes: [
    "Fallacy is included as HP-scaling Echo damage; its ER/ATK window is triggered by the Echo action.",
    "The post-Liberation actions give Photosynthesis Mark a deterministic personal window for coordinated attacks once the runtime mark trigger is present.",
  ],
};

export const personalRotationScenarios: readonly PersonalRotationScenario[] = [
  aemeathTune,
  aemeathFusion,
  calcharo,
  chisa,
  verina,
];

export function findPersonalRotationScenario(
  resonatorId: string,
  resonanceMode?: string,
): PersonalRotationScenario | undefined {
  const candidates = personalRotationScenarios.filter(
    (scenario) => scenario.resonatorId === resonatorId,
  );
  if (!candidates.length) return undefined;
  return (
    candidates.find((scenario) => scenario.resonanceMode === resonanceMode) ??
    candidates.find((scenario) => scenario.resonanceMode === undefined) ??
    candidates[0]
  );
}
