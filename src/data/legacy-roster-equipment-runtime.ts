import type { EffectDefinition } from "@/domain/effect-models";
import type { CombatAction, CombatEffect, MainEcho, Sonata, SonataPieceBonus } from "@/domain/models";

const source = {
  kind: "multi-source-verified" as const,
  source: "WUWA GameDatabase V1 Release + reviewed Prydwen build guidance",
  gameVersion: "3.5",
  verifiedAt: "2026-08-20",
  notes:
    "Canonical Sonata/Echo ids and Echo skill values come from the committed GameDatabase. Build-owned Main Echo choices are reviewed against current build guidance. Only personal effects executable without inventing missing timing/status context are activated.",
};

const unknown = () => ({ value: null, confidence: "unknown" as const });
const effectSource = (id: string, label: string): EffectDefinition["source"] => ({
  id,
  type: "sonata",
  label,
  metadata: source,
});
const wrap = (definition: EffectDefinition, description: string): CombatEffect => ({
  id: definition.id,
  name: definition.label,
  sourceId: definition.source.id,
  trigger: definition.label,
  target: "self",
  effect: description,
  structuredEffect: definition,
  source,
});
const staticEffect = (
  id: string,
  label: string,
  modifiers: EffectDefinition["rules"][number]["modifiers"],
  selectors?: EffectDefinition["rules"][number]["selectors"],
): CombatEffect => {
  const definition: EffectDefinition = {
    id,
    label,
    source: effectSource(id.split(":").slice(0, 2).join(":"), label.split(" 2-piece")[0] ?? label),
    target: "self",
    activationPolicy: "initially-active",
    rules: [{ id: `${id}:rule`, label, accounting: "runtime", ...(selectors ? { selectors } : {}), modifiers }],
  };
  return wrap(definition, "Always-active personal tier bonus.");
};
const action = (id: string, name: string, multipliers: readonly { percent: number; hits: number }[], cooldownSeconds: number): CombatAction => ({
  id,
  name,
  talent: "echoSkill",
  damageType: "echoSkill",
  scalingAttribute: "attack",
  level: 10,
  multipliers,
  cooldownSeconds,
  castDurationSeconds: unknown(),
  recoverySeconds: unknown(),
  hitTimingsSeconds: unknown(),
  source,
});
const mainSlotEffect = (
  id: string,
  label: string,
  modifiers: EffectDefinition["rules"][number]["modifiers"],
  selectors?: EffectDefinition["rules"][number]["selectors"],
): CombatEffect => {
  const definition: EffectDefinition = {
    id,
    label,
    source: { id, type: "echo", label, metadata: source },
    target: "self",
    activationPolicy: "initially-active",
    rules: [{ id: `${id}:rule`, label, accounting: "runtime", ...(selectors ? { selectors } : {}), modifiers }],
  };
  return wrap(definition, "Main-slot personal bonus.");
};

const tidebreaking2 = staticEffect(
  "sonata-set:14:2pc:energy-regen",
  "Tidebreaking Courage 2-piece — Energy Regen",
  [{ kind: "runtime-stat", stat: "energyRegen", mode: "flat", stacking: "additive", value: { kind: "constant", value: 10 } }],
);
const tidebreaking5: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:14:5pc:personal",
    label: "Tidebreaking Courage 5-piece — personal ATK / Attribute DMG",
    source: effectSource("sonata-set:14", "Tidebreaking Courage"),
    target: "self",
    activationPolicy: "initially-active",
    rules: [
      {
        id: "sonata-set:14:5pc:attack",
        label: "+15% ATK",
        accounting: "runtime",
        modifiers: [{ kind: "runtime-stat", stat: "attack", mode: "percent", stacking: "additive", value: { kind: "constant", value: 15 } }],
      },
      {
        id: "sonata-set:14:5pc:attribute-dmg",
        label: "+30% all Attribute DMG at 250% Energy Regen",
        accounting: "runtime",
        predicates: [{ kind: "stat", stat: "energyRegen", comparison: "gte", value: { kind: "constant", value: 250 } }],
        modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 30 }],
      },
    ],
  };
  return wrap(definition, "+15% ATK; at 250% Energy Regen or above, +30% all Attribute DMG.");
})();

const frosty2 = staticEffect(
  "sonata-set:10:2pc:skill",
  "Frosty Resolve 2-piece — Resonance Skill DMG",
  [{ kind: "damage-type-bonus", stacking: "additive", value: 12 }],
  [{ kind: "damage-type", anyOf: ["resonanceSkill"] }],
);
const frostyGlacio: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:10:5pc:glacio",
    label: "Frosty Resolve 5-piece — Glacio after Skill",
    source: effectSource("sonata-set:10", "Frosty Resolve"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: { duration: { kind: "fixed", seconds: 15 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
    rules: [{ id: "sonata-set:10:5pc:glacio:rule", label: "+22.5% Glacio DMG", accounting: "runtime", selectors: [{ kind: "element", anyOf: ["glacio"] }], modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 22.5 }] }],
    triggers: [{ id: "sonata-set:10:5pc:on-skill", event: "damage-dealt", predicates: [{ kind: "identity", field: "damageType", anyOf: ["resonanceSkill"] }], operations: [{ kind: "activate-effect", effectId: "sonata-set:10:5pc:glacio" }] }],
  };
  return wrap(definition, "Dealing Resonance Skill DMG activates +22.5% Glacio DMG for 15s.");
})();
const frostySkillStacks: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:10:5pc:skill-stacks",
    label: "Frosty Resolve 5-piece — Skill DMG stacks after Liberation",
    source: effectSource("sonata-set:10", "Frosty Resolve"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: { duration: { kind: "fixed", seconds: 5 }, refresh: "reset-duration", uniqueness: "refresh-existing", stacks: { kind: "shared", max: 2, initial: 0 } },
    rules: [{ id: "sonata-set:10:5pc:skill-stacks:rule", label: "+18% Resonance Skill DMG per stack", accounting: "runtime", selectors: [{ kind: "damage-type", anyOf: ["resonanceSkill"] }], modifiers: [{ kind: "damage-type-bonus", stacking: "additive", valuePerStack: 18, maxStacks: 2 }] }],
    triggers: [{ id: "sonata-set:10:5pc:on-liberation", event: "damage-dealt", predicates: [{ kind: "identity", field: "damageType", anyOf: ["resonanceLiberation"] }], operations: [{ kind: "activate-effect", effectId: "sonata-set:10:5pc:skill-stacks" }, { kind: "gain-stacks", effectId: "sonata-set:10:5pc:skill-stacks", amount: { kind: "constant", value: 1 } }] }],
  };
  return wrap(definition, "Resonance Liberation grants +18% Resonance Skill DMG for 5s, stacking up to 2 times.");
})();

const windward2 = staticEffect("sonata-set:17:2pc:aero", "Windward Pilgrimage 2-piece — Aero DMG", [{ kind: "elemental-damage-bonus", stacking: "additive", value: 10 }], [{ kind: "element", anyOf: ["aero"] }]);
const windward5: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:17:5pc:aero-erosion",
    label: "Windward Pilgrimage 5-piece — Aero Erosion window",
    source: effectSource("sonata-set:17", "Windward Pilgrimage"),
    target: "self",
    activationPolicy: "manual-only",
    lifecycle: { duration: { kind: "fixed", seconds: 10 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
    rules: [{ id: "sonata-set:17:5pc:rule", label: "+10% Crit Rate / +30% Aero DMG", accounting: "runtime", modifiers: [{ kind: "crit-rate-bonus", stacking: "additive", value: 10 }, { kind: "elemental-damage-bonus", stacking: "additive", value: 30 }], selectors: [{ kind: "element", anyOf: ["aero"] }] }],
  };
  return wrap(definition, "Exact 10s bonus is stored, but activation remains manual until Aero Erosion status ownership is executable in the legacy scenario.");
})();

const molten2 = staticEffect("sonata-set:2:2pc:fusion", "Molten Rift 2-piece — Fusion DMG", [{ kind: "elemental-damage-bonus", stacking: "additive", value: 10 }], [{ kind: "element", anyOf: ["fusion"] }]);
const molten5: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:2:5pc:skill-window",
    label: "Molten Rift 5-piece — Fusion after Skill",
    source: effectSource("sonata-set:2", "Molten Rift"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: { duration: { kind: "fixed", seconds: 15 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
    rules: [{ id: "sonata-set:2:5pc:rule", label: "+30% Fusion DMG", accounting: "runtime", selectors: [{ kind: "element", anyOf: ["fusion"] }], modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 30 }] }],
    triggers: [{ id: "sonata-set:2:5pc:on-skill", event: "damage-dealt", predicates: [{ kind: "identity", field: "damageType", anyOf: ["resonanceSkill"] }], operations: [{ kind: "activate-effect", effectId: "sonata-set:2:5pc:skill-window" }] }],
  };
  return wrap(definition, "Dealing Resonance Skill DMG activates +30% Fusion DMG for 15s.");
})();

const gusts2 = staticEffect("sonata-set:16:2pc:aero", "Gusts of Welkin 2-piece — Aero DMG", [{ kind: "elemental-damage-bonus", stacking: "additive", value: 10 }], [{ kind: "element", anyOf: ["aero"] }]);
const gusts5: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:16:5pc:aero-erosion-self",
    label: "Gusts of Welkin 5-piece — personal Aero Erosion window",
    source: effectSource("sonata-set:16", "Gusts of Welkin"),
    target: "self",
    activationPolicy: "manual-only",
    lifecycle: { duration: { kind: "fixed", seconds: 20 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
    rules: [{ id: "sonata-set:16:5pc:self", label: "+30% personal Aero DMG", accounting: "runtime", selectors: [{ kind: "element", anyOf: ["aero"] }], modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 30 }] }],
  };
  return wrap(definition, "The personal +30% Aero window is stored. Its Aero Erosion trigger remains manual; the separate +15% team component is Team-DPS-owned.");
})();

const bonuses = (...entries: SonataPieceBonus[]): readonly SonataPieceBonus[] => entries;
export const legacyRosterSonatas: readonly Sonata[] = [
  { id: "sonata-set:14", name: "Tidebreaking Courage", pieceBonuses: bonuses({ pieces: 2, effects: [tidebreaking2] }, { pieces: 5, effects: [tidebreaking5] }), source },
  { id: "sonata-set:10", name: "Frosty Resolve", pieceBonuses: bonuses({ pieces: 2, effects: [frosty2] }, { pieces: 5, effects: [frostyGlacio, frostySkillStacks] }), source },
  { id: "sonata-set:17", name: "Windward Pilgrimage", pieceBonuses: bonuses({ pieces: 2, effects: [windward2] }, { pieces: 5, effects: [windward5] }), source },
  { id: "sonata-set:2", name: "Molten Rift", pieceBonuses: bonuses({ pieces: 2, effects: [molten2] }, { pieces: 5, effects: [molten5] }), source },
  { id: "sonata-set:16", name: "Gusts of Welkin", pieceBonuses: bonuses({ pieces: 2, effects: [gusts2] }, { pieces: 5, effects: [gusts5] }), source },
];

export const legacyRosterMainEchoIdByResonatorId = {
  augusta: "echo:6000121",
  brant: "echo:6000084",
  cantarella: "echo:6000082",
  carlotta: "echo:6000083",
  cartethyia: "echo:6000106",
  changli: "echo:6000091",
  ciaccona: "echo:6000113",
} as const;

export const legacyRosterMainEchoes: readonly MainEcho[] = [
  {
    id: "echo:6000121",
    name: "The False Sovereign",
    sonataIds: ["sonata-set:20"],
    skillDescription: "55.35% Electro DMG x4. Main slot: +12% Electro DMG and +12% Heavy Attack DMG. Intro also summons a 405% hit; that follow-up is not emitted until legacy Intro ownership is reviewed. CD 8s, 2 charges.",
    action: action("legacy-false-sovereign-echo-skill", "The False Sovereign · Spinning Strike", [{ percent: 55.35, hits: 4 }], 8),
    effects: [mainSlotEffect("legacy-false-sovereign-electro", "The False Sovereign · +12% Electro DMG", [{ kind: "elemental-damage-bonus", stacking: "additive", value: 12 }], [{ kind: "element", anyOf: ["electro"] }]), mainSlotEffect("legacy-false-sovereign-heavy", "The False Sovereign · +12% Heavy Attack DMG", [{ kind: "damage-type-bonus", stacking: "additive", value: 12 }], [{ kind: "damage-type", anyOf: ["heavyAttack"] }])],
    source,
  },
  {
    id: "echo:6000084",
    name: "Dragon of Dirge",
    sonataIds: ["sonata-set:14"],
    skillDescription: "Grief Rift periodically deals 36.81% Fusion DMG for 5s. Main slot: +12% Fusion DMG and +12% Basic Attack DMG. Tick count is not invented, so no direct action is emitted yet. CD 25s.",
    effects: [mainSlotEffect("legacy-dragon-dirge-fusion", "Dragon of Dirge · +12% Fusion DMG", [{ kind: "elemental-damage-bonus", stacking: "additive", value: 12 }], [{ kind: "element", anyOf: ["fusion"] }]), mainSlotEffect("legacy-dragon-dirge-basic", "Dragon of Dirge · +12% Basic Attack DMG", [{ kind: "damage-type-bonus", stacking: "additive", value: 12 }], [{ kind: "damage-type", anyOf: ["basicAttack"] }])],
    source,
  },
  {
    id: "echo:6000082",
    name: "Lorelei",
    sonataIds: ["sonata-set:12"],
    skillDescription: "405% Havoc DMG. Main slot: +12% Havoc DMG and +12% Basic Attack DMG. CD 25s.",
    action: action("legacy-lorelei-echo-skill", "Lorelei · Transform", [{ percent: 405, hits: 1 }], 25),
    effects: [mainSlotEffect("legacy-lorelei-havoc", "Lorelei · +12% Havoc DMG", [{ kind: "elemental-damage-bonus", stacking: "additive", value: 12 }], [{ kind: "element", anyOf: ["havoc"] }]), mainSlotEffect("legacy-lorelei-basic", "Lorelei · +12% Basic Attack DMG", [{ kind: "damage-type-bonus", stacking: "additive", value: 12 }], [{ kind: "damage-type", anyOf: ["basicAttack"] }])],
    source,
  },
  {
    id: "echo:6000083",
    name: "Sentry Construct",
    sonataIds: ["sonata-set:10"],
    skillDescription: "405% Glacio DMG. Main slot: +12% Glacio DMG and +12% Resonance Skill DMG. Strike Capacitor cooldown-reset behavior remains scenario-owned. CD 25s.",
    action: action("legacy-sentry-construct-echo-skill", "Sentry Construct · Strike", [{ percent: 405, hits: 1 }], 25),
    effects: [mainSlotEffect("legacy-sentry-glacio", "Sentry Construct · +12% Glacio DMG", [{ kind: "elemental-damage-bonus", stacking: "additive", value: 12 }], [{ kind: "element", anyOf: ["glacio"] }]), mainSlotEffect("legacy-sentry-skill", "Sentry Construct · +12% Resonance Skill DMG", [{ kind: "damage-type-bonus", stacking: "additive", value: 12 }], [{ kind: "damage-type", anyOf: ["resonanceSkill"] }])],
    source,
  },
  {
    id: "echo:6000106",
    name: "Reminiscence: Fleurdelys",
    sonataIds: ["sonata-set:16", "sonata-set:17"],
    skillDescription: "27.36% Aero DMG x8 + 136.80%. Main slot: +10% Aero DMG, plus another +10% for Cartethyia (or Aero Rover). CD 20s.",
    action: action("legacy-fleurdelys-echo-skill", "Reminiscence: Fleurdelys · Windcleaver", [{ percent: 27.36, hits: 8 }, { percent: 136.8, hits: 1 }], 20),
    effects: [mainSlotEffect("legacy-fleurdelys-aero", "Reminiscence: Fleurdelys · +10% Aero DMG", [{ kind: "elemental-damage-bonus", stacking: "additive", value: 10 }], [{ kind: "element", anyOf: ["aero"] }]), mainSlotEffect("legacy-fleurdelys-cartethyia", "Reminiscence: Fleurdelys · Cartethyia +10% Aero DMG", [{ kind: "elemental-damage-bonus", stacking: "additive", value: 10 }], [{ kind: "owner-id", anyOf: ["cartethyia"] }, { kind: "element", anyOf: ["aero"] }])],
    source,
  },
  {
    id: "echo:6000091",
    name: "Nightmare: Inferno Rider",
    sonataIds: ["sonata-set:2"],
    skillDescription: "Tap deals 405% Fusion DMG. Main slot: +12% Fusion DMG and +12% Resonance Skill DMG. Held Riding Mode is not assumed. CD 25s.",
    action: action("legacy-nightmare-inferno-rider-echo-skill", "Nightmare: Inferno Rider · Jump", [{ percent: 405, hits: 1 }], 25),
    effects: [mainSlotEffect("legacy-nightmare-inferno-fusion", "Nightmare: Inferno Rider · +12% Fusion DMG", [{ kind: "elemental-damage-bonus", stacking: "additive", value: 12 }], [{ kind: "element", anyOf: ["fusion"] }]), mainSlotEffect("legacy-nightmare-inferno-skill", "Nightmare: Inferno Rider · +12% Resonance Skill DMG", [{ kind: "damage-type-bonus", stacking: "additive", value: 12 }], [{ kind: "damage-type", anyOf: ["resonanceSkill"] }])],
    source,
  },
  {
    id: "echo:6000113",
    name: "Nightmare: Kelpie",
    sonataIds: ["sonata-set:16", "sonata-set:17"],
    skillDescription: "Transform hit is 405% Glacio DMG; Outro summons 405% Aero DMG. Main slot: +12% Glacio and +12% Aero DMG. Direct action is withheld because the current Personal action model does not yet carry an Echo-specific element override.",
    effects: [mainSlotEffect("legacy-nightmare-kelpie-glacio", "Nightmare: Kelpie · +12% Glacio DMG", [{ kind: "elemental-damage-bonus", stacking: "additive", value: 12 }], [{ kind: "element", anyOf: ["glacio"] }]), mainSlotEffect("legacy-nightmare-kelpie-aero", "Nightmare: Kelpie · +12% Aero DMG", [{ kind: "elemental-damage-bonus", stacking: "additive", value: 12 }], [{ kind: "element", anyOf: ["aero"] }])],
    source,
  },
];
