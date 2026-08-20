import type { CombatAction, CombatEffect, MainEcho } from "@/domain/models";
import type { EffectDefinition, EffectModifier, EffectSelector, RuntimeStatModifier } from "@/domain/effect-models";
import { generatedPreciseCharacterBoxEchoPresets } from "@/generated/precise-character-box-echo-presets";

const gameSource = {
  kind: "verified-game-data" as const,
  source: "WUWA GameDatabase V1 · Echo skill projection",
  gameVersion: "3.5",
  verifiedAt: "2026-08-20",
  notes:
    "Canonical Echo identity comes from the generated GameDatabase loadout. Rank-5 Echo Skill multipliers, cooldowns and main-slot personal bonuses are reviewed data. Incoming-resonator/team-only handoff buffs remain Team-DPS-owned.",
};

const unknown = () => ({ value: null, confidence: "unknown" as const });
const canonicalId = (key: keyof typeof generatedPreciseCharacterBoxEchoPresets) =>
  generatedPreciseCharacterBoxEchoPresets[key].mainEchoCanonicalId;

const wrap = (definition: EffectDefinition, description: string): CombatEffect => ({
  id: definition.id,
  name: definition.label,
  sourceId: definition.source.id,
  trigger: definition.label,
  target: "self",
  effect: description,
  structuredEffect: definition,
  source: gameSource,
});

const alwaysOn = (
  id: string,
  label: string,
  modifiers: readonly (EffectModifier | RuntimeStatModifier)[],
  selectors?: readonly EffectSelector[],
): CombatEffect => {
  const definition: EffectDefinition = {
    id,
    label,
    source: { id, type: "echo", label, metadata: gameSource },
    target: "self",
    activationPolicy: "initially-active",
    rules: [
      {
        id: `${id}-rule`,
        label,
        accounting: "runtime",
        ...(selectors ? { selectors } : {}),
        modifiers,
      },
    ],
  };
  return wrap(definition, "Main-slot personal bonus; active while this Echo is equipped in the Main Echo slot.");
};

const action = (
  id: string,
  name: string,
  multipliers: readonly { percent: number; hits: number }[],
  cooldownSeconds: number,
  scalingAttribute: "attack" | "hp" | "defense" = "attack",
): CombatAction => ({
  id,
  name,
  talent: "echoSkill",
  damageType: "echoSkill",
  scalingAttribute,
  level: 10,
  multipliers,
  cooldownSeconds,
  castDurationSeconds: unknown(),
  recoverySeconds: unknown(),
  hitTimingsSeconds: unknown(),
  source: gameSource,
});

const nightmareHecateId = canonicalId("phrolova");
const reminiscenceDeniaId = canonicalId("denia-fusion-burst");
const voidwingMothId = canonicalId("denia-tune-strain");
const hyvatiaId = canonicalId("lynae");
const reactorHuskId = canonicalId("mornye");
const fenricoId = canonicalId("qiuyuan");
const jueId = canonicalId("jinhsi");
const corrosaurusId = canonicalId("galbrena");
const ladyOfTheSeaId = canonicalId("iuno");
const voidborneConstructId = canonicalId("hiyuki");

const jueBlessingDefinition: EffectDefinition = {
  id: "precise-jue-blessing-of-time",
  label: "Jué · Blessing of Time",
  source: { id: jueId, type: "echo", label: "Jué", metadata: gameSource },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 15 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "precise-jue-skill-dmg",
      label: "+16% Resonance Skill DMG",
      accounting: "runtime",
      selectors: [{ kind: "damage-type", anyOf: ["resonanceSkill"] }],
      modifiers: [
        { kind: "damage-type-bonus", stacking: "additive", value: 16 },
      ],
    },
  ],
  triggers: [
    {
      id: "precise-jue-cast",
      event: "action-end",
      predicates: [
        { kind: "identity", field: "actionId", anyOf: ["precise-jue-echo-skill"] },
      ],
      operations: [
        { kind: "activate-effect", effectId: "precise-jue-blessing-of-time" },
      ],
    },
  ],
};

export const preciseModernMainEchoes: readonly MainEcho[] = [
  {
    id: nightmareHecateId,
    name: "Nightmare: Hecate",
    sonataIds: ["sonata-set:19"],
    skillDescription:
      "Three Havoc hits at 152.39% ATK each. Main slot: +12% Havoc DMG and +20% Echo Skill DMG. CD 25s.",
    action: action("precise-nightmare-hecate-echo-skill", "Nightmare: Hecate · Smash", [{ percent: 152.39, hits: 3 }], 25),
    effects: [
      alwaysOn("precise-nightmare-hecate-element", "Nightmare: Hecate · +12% Havoc DMG", [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 12 },
      ]),
      alwaysOn("precise-nightmare-hecate-echo", "Nightmare: Hecate · +20% Echo Skill DMG", [
        { kind: "damage-type-bonus", stacking: "additive", value: 20 },
      ], [{ kind: "damage-type", anyOf: ["echoSkill"] }]),
    ],
    source: gameSource,
  },
  {
    id: reminiscenceDeniaId,
    name: "Reminiscence: Denia",
    sonataIds: ["sonata-set:28"],
    skillDescription:
      "Summon Trickster for 273.60% Fusion DMG. The 15s Outro handoff grants the incoming Resonator +12% Fusion DMG and is Team-DPS-owned. CD 20s.",
    action: action("precise-reminiscence-denia-echo-skill", "Reminiscence: Denia · Trickster", [{ percent: 273.6, hits: 1 }], 20),
    source: gameSource,
  },
  {
    id: voidwingMothId,
    name: "Voidwing Moth",
    sonataIds: ["sonata-set:31"],
    skillDescription:
      "Tap deals 405.00% Spectro DMG. The optional held sequence and 15s Outro incoming-ATK handoff are not assumed by Personal DPS. CD 25s.",
    action: action("precise-voidwing-moth-echo-skill", "Voidwing Moth · Tap", [{ percent: 405, hits: 1 }], 25),
    source: gameSource,
  },
  {
    id: hyvatiaId,
    name: "Hyvatia",
    sonataIds: ["sonata-set:24", "sonata-set:26"],
    skillDescription:
      "Summon Hyvatia for 10 hits of 27.36% Spectro DMG. The following Outro-to-next-Intro all-attribute bonus is Team-DPS-owned. CD 20s.",
    action: action("precise-hyvatia-echo-skill", "Hyvatia · Summon", [{ percent: 27.36, hits: 10 }], 20),
    source: gameSource,
  },
  {
    id: reactorHuskId,
    name: "Reactor Husk",
    sonataIds: ["sonata-set:25", "sonata-set:28"],
    skillDescription:
      "Heavy slash deals 351.00% Fusion DMG. Main slot: +10% Energy Regen. CD 20s.",
    action: action("precise-reactor-husk-echo-skill", "Reactor Husk · Heavy Slash", [{ percent: 351, hits: 1 }], 20),
    effects: [
      alwaysOn("precise-reactor-husk-main-slot", "Reactor Husk · Main-slot Energy Regen", [
        {
          kind: "runtime-stat",
          stat: "energyRegen",
          mode: "flat",
          stacking: "additive",
          value: { kind: "constant", value: 10 },
        },
      ]),
    ],
    source: gameSource,
  },
  {
    id: fenricoId,
    name: "Reminiscence: Fenrico",
    sonataIds: ["sonata-set:19", "sonata-set:21"],
    skillDescription:
      "Summon Talons of Decree for 273.60% Aero DMG. Main slot: +12% Aero DMG and +12% Heavy Attack DMG. CD 20s.",
    action: action("precise-fenrico-echo-skill", "Reminiscence: Fenrico · Talons of Decree", [{ percent: 273.6, hits: 1 }], 20),
    effects: [
      alwaysOn("precise-fenrico-element", "Reminiscence: Fenrico · +12% Aero DMG", [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 12 },
      ]),
      alwaysOn("precise-fenrico-heavy", "Reminiscence: Fenrico · +12% Heavy Attack DMG", [
        { kind: "damage-type-bonus", stacking: "additive", value: 12 },
      ], [{ kind: "damage-type", anyOf: ["heavyAttack"] }]),
    ],
    source: gameSource,
  },
  {
    id: jueId,
    name: "Jué",
    sonataIds: ["sonata-set:5"],
    skillDescription:
      "48.64% Spectro, then up to 5x19.46%, then 2x48.64%. Casting grants +16% Resonance Skill DMG for 15s; the conditional 16%/s skill-hit follow-up remains explicitly un-emitted until its periodic hit ownership is represented. CD 20s.",
    action: action("precise-jue-echo-skill", "Jué · Blessing of Time", [
      { percent: 48.64, hits: 1 },
      { percent: 19.46, hits: 5 },
      { percent: 48.64, hits: 2 },
    ], 20),
    effects: [wrap(jueBlessingDefinition, "Casting Jué grants +16% Resonance Skill DMG for 15s.")],
    source: gameSource,
  },
  {
    id: corrosaurusId,
    name: "Corrosaurus",
    sonataIds: ["sonata-set:22"],
    skillDescription:
      "Summon Corrosaurus for 273.60% Fusion DMG. Main slot: +12% Fusion DMG and +20% Echo Skill DMG. CD 20s.",
    action: action("precise-corrosaurus-echo-skill", "Corrosaurus · Summon", [{ percent: 273.6, hits: 1 }], 20),
    effects: [
      alwaysOn("precise-corrosaurus-element", "Corrosaurus · +12% Fusion DMG", [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 12 },
      ]),
      alwaysOn("precise-corrosaurus-echo", "Corrosaurus · +20% Echo Skill DMG", [
        { kind: "damage-type-bonus", stacking: "additive", value: 20 },
      ], [{ kind: "damage-type", anyOf: ["echoSkill"] }]),
    ],
    source: gameSource,
  },
  {
    id: ladyOfTheSeaId,
    name: "Lady of the Sea",
    sonataIds: ["sonata-set:20"],
    skillDescription:
      "Tidestorm deals 10x13.68% plus 164.16% Aero DMG. Main slot: +12% Aero DMG and +12% Resonance Liberation DMG. CD 20s.",
    action: action("precise-lady-of-the-sea-echo-skill", "Lady of the Sea · Tidestorm", [
      { percent: 13.68, hits: 10 },
      { percent: 164.16, hits: 1 },
    ], 20),
    effects: [
      alwaysOn("precise-lady-of-the-sea-element", "Lady of the Sea · +12% Aero DMG", [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 12 },
      ]),
      alwaysOn("precise-lady-of-the-sea-liberation", "Lady of the Sea · +12% Resonance Liberation DMG", [
        { kind: "damage-type-bonus", stacking: "additive", value: 12 },
      ], [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }]),
    ],
    source: gameSource,
  },
  {
    id: voidborneConstructId,
    name: "Reminiscence: Threnodian - Voidborne Construct",
    sonataIds: ["sonata-set:30"],
    skillDescription:
      "Summon Aleph-1's Creation for 5x21.88% plus 164.16% Glacio DMG. Main slot: +12% Glacio DMG and +12% Resonance Liberation DMG. CD 20s.",
    action: action("precise-voidborne-construct-echo-skill", "Voidborne Construct · Aleph-1's Creation", [
      { percent: 21.88, hits: 5 },
      { percent: 164.16, hits: 1 },
    ], 20),
    effects: [
      alwaysOn("precise-voidborne-construct-element", "Voidborne Construct · +12% Glacio DMG", [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 12 },
      ]),
      alwaysOn("precise-voidborne-construct-liberation", "Voidborne Construct · +12% Resonance Liberation DMG", [
        { kind: "damage-type-bonus", stacking: "additive", value: 12 },
      ], [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }]),
    ],
    source: gameSource,
  },
];
