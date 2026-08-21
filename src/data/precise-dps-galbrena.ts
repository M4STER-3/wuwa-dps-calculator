import type {
  CombatPredicate,
  EffectDefinition,
  ValueExpression,
} from "@/domain/effect-models";
import type {
  CombatAction,
  CombatEffect,
  CombatResource,
  Resonator,
  SourceMetadata,
  Weapon,
} from "@/domain/models";

export const GALBRENA = {
  basic1: "precise-galbrena-attr-1208001",
  basic2: "precise-galbrena-attr-1208002",
  basic3: "precise-galbrena-attr-1208003",
  basic4: "precise-galbrena-attr-1208004",
  dodge: "precise-galbrena-attr-1208005",
  ashfallPlunge: "precise-galbrena-attr-1208006",
  ashfallSustain: "precise-galbrena-attr-1208007",
  volley1: "precise-galbrena-attr-1208008",
  volley2: "precise-galbrena-attr-1208009",
  volley3: "precise-galbrena-attr-1208010",
  intro: "precise-galbrena-attr-1208011",
  encroach: "precise-galbrena-attr-1208014",
  ascent: "precise-galbrena-attr-1208015",
  liberation: "precise-galbrena-attr-1208016",
  seraphic1: "precise-galbrena-attr-1208017",
  seraphic2: "precise-galbrena-attr-1208018",
  seraphic3: "precise-galbrena-attr-1208019",
  seraphic4: "precise-galbrena-attr-1208020",
  seraphic5: "precise-galbrena-attr-1208021",
  flamewing1: "precise-galbrena-attr-1208022",
  flamewing2: "precise-galbrena-attr-1208023",
  flamewing3: "precise-galbrena-attr-1208024",
  purgatory: "precise-galbrena-attr-1208025",
  hellsentPlunge: "precise-galbrena-attr-1208042",
  hellsentSustain: "precise-galbrena-attr-1208043",
  ravage: "precise-galbrena-attr-1208046",
  outro: "precise-galbrena-outro-ashen-pursuit",
} as const;

export const GALBRENA_REFERENCE_ECHO_EVENT = "galbrena-reference-main-echo";
export const GALBRENA_DEMON_EXIT_EVENT = "galbrena-reference-demon-exit";

const source: SourceMetadata = {
  kind: "multi-source-verified",
  source: "WUWA GameDatabase / Prydwen / WutheringTools · Galbrena precise DPS",
  gameVersion: "3.5",
  verifiedAt: "2026-08-20",
  notes:
    "GameDatabase owns exact Lv1-10 motion values. Prydwen/WutheringTools own reviewed classifications, kit mechanics and the 12.2s reference rotation contract.",
};

const constant = (value: number): ValueExpression => ({ kind: "constant", value });
const resource = (resourceId: string): ValueExpression => ({ kind: "resource", resourceId });
const stacks = (): ValueExpression => ({ kind: "stacks" });
const rank = (values: readonly number[]): ValueExpression => ({
  kind: "rank",
  values: Object.fromEntries(values.map((value, index) => [index + 1, value])),
});
const actionPredicate = (...ids: string[]): CombatPredicate => ({
  kind: "identity",
  field: "actionId",
  anyOf: ids,
});
const sequenceAtLeast = (value: number): CombatPredicate => ({
  kind: "state-active",
  id: `sequence-at-least-${value}`,
});
const not = (predicate: CombatPredicate): CombatPredicate => ({ kind: "not", predicate });
const and = (...predicates: readonly CombatPredicate[]): CombatPredicate => ({
  kind: "and",
  predicates,
});

const unknownTiming = (note: string) => ({
  value: null,
  confidence: "unknown" as const,
  sourceNote: note,
});

const galbrenaResources: readonly CombatResource[] = [
  {
    id: "afterflame",
    name: "Afterflame",
    cap: 40,
    semantic: "character-resource",
    notes: ["Exact cap 40. Threshold-state Echo casts grant 8; same Echo name can trigger once per Demon cycle."],
  },
  {
    id: "sinflame",
    name: "Sinflame",
    cap: 100,
    semantic: "character-resource",
    notes: [
      "Exact cap 100. Public data confirms generation by Threshold attacks but does not expose a safe per-hit numeric split; the reviewed scenario asserts the exact 100-point Ascent eligibility checkpoint.",
    ],
  },
  {
    id: "purging-flame",
    name: "Purging Flame",
    cap: 100,
    semantic: "character-resource",
    notes: [
      "Ascent converts full Sinflame 1:1 to 100 Purging Flame. Enhanced attacks consume it; the reviewed standard route owns the exact depletion endpoint instead of inventing per-hit costs.",
    ],
  },
];

const manualOutro: CombatAction = {
  id: GALBRENA.outro,
  name: "Ashen Pursuit",
  talent: "outroSkill",
  scaling: "damage",
  scalingAttribute: "attack",
  level: 10,
  multipliers: [
    { percent: 79.5, hits: 3 },
    { percent: 556.5, hits: 1 },
  ],
  castDurationSeconds: unknownTiming(
    "No reviewed frame-exact Outro duration is published; the theoretical timeline owns action timing.",
  ),
  recoverySeconds: unknownTiming("No reviewed recovery timing is published."),
  hitTimingsSeconds: unknownTiming("No reviewed frame-exact hit timestamps are published."),
  notes: [
    "Verified Outro scaling: 79.5%×3 + 556.5% ATK.",
    "Outro damage has no Heavy/Echo category in the public kit, so no synthetic damage type is assigned.",
  ],
  source,
};

type PreciseAction = CombatAction & { readonly sourceAttributeId?: string };

const heavyIds = new Set([
  "1208001", "1208002", "1208003", "1208005", "1208006", "1208007",
  "1208008", "1208009", "1208010", "1208014", "1208015",
  "1208017", "1208018", "1208019", "1208022", "1208023",
  "1208025", "1208042", "1208043", "1208046",
]);
const echoIds = new Set(["1208004", "1208016", "1208020", "1208021", "1208024"]);

/** Exact damage classification patch over generated GameDatabase identities. */
export function applyPreciseGalbrenaActionPatches(
  actions: readonly PreciseAction[],
): readonly PreciseAction[] {
  const patched = actions.map((action) => {
    if (action.sourceAttributeId && heavyIds.has(action.sourceAttributeId)) {
      return {
        ...action,
        damageType: "heavyAttack" as const,
        notes: [...(action.notes ?? []), "Galbrena kit classifies this hit as Heavy Attack DMG."],
      };
    }
    if (action.sourceAttributeId && echoIds.has(action.sourceAttributeId)) {
      return {
        ...action,
        damageType: "echoSkill" as const,
        notes: [...(action.notes ?? []), "Galbrena kit classifies this hit as Echo Skill DMG."],
      };
    }
    return action;
  });
  if (patched.some((action) => action.id === manualOutro.id)) {
    throw new Error(`Galbrena manual action id collides with generated action ${manualOutro.id}.`);
  }
  return [...patched, manualOutro];
}

const enhancedIds = [
  GALBRENA.seraphic1,
  GALBRENA.seraphic2,
  GALBRENA.seraphic3,
  GALBRENA.seraphic4,
  GALBRENA.seraphic5,
  GALBRENA.flamewing1,
  GALBRENA.flamewing2,
  GALBRENA.flamewing3,
  GALBRENA.hellsentPlunge,
  GALBRENA.hellsentSustain,
  GALBRENA.purgatory,
  GALBRENA.ravage,
] as const;
const liberationBuffIds = enhancedIds.filter((id) => id !== GALBRENA.ravage);

const burningDrive: EffectDefinition = {
  id: "precise-galbrena-burning-drive",
  label: "Burning Drive",
  source: { id: "galbrena-burning-drive", type: "resonator", label: "Burning Drive" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 4 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "galbrena-burning-drive-atk",
      label: "Burning Drive · +20% ATK",
      accounting: "runtime",
      modifiers: [{
        kind: "runtime-stat",
        stat: "attack",
        mode: "percent",
        stacking: "additive",
        value: constant(20),
      }],
    },
    {
      id: "galbrena-s2-burning-drive-extra",
      label: "S2 · Burning Drive grants 350% more ATK Bonus (+70 points over the base +20%)",
      accounting: "runtime",
      requiredSequence: 2,
      modifiers: [{
        kind: "runtime-stat",
        stat: "attack",
        mode: "percent",
        stacking: "additive",
        value: constant(70),
      }],
    },
  ],
  triggers: [
    {
      id: "galbrena-burning-drive-trigger",
      event: "action-start",
      predicates: [actionPredicate(
        GALBRENA.intro,
        GALBRENA.seraphic4,
        GALBRENA.encroach,
        GALBRENA.ascent,
        GALBRENA.ravage,
      )],
      operations: [{ kind: "activate-effect", effectId: "precise-galbrena-burning-drive" }],
    },
  ],
};

const stateMachine: EffectDefinition = {
  id: "precise-galbrena-state-machine",
  label: "Threshold / Demon Hypostasis state machine",
  source: { id: "galbrena-forte", type: "resonator", label: "Beyond Threshold" },
  target: "self",
  rules: [],
  triggers: [
    {
      id: "galbrena-ascent-reviewed-full-sinflame",
      event: "rotation-step-start",
      predicates: [actionPredicate(GALBRENA.ascent)],
      operations: [{ kind: "resource", operation: "set-max", resourceId: "sinflame" }],
    },
    {
      id: "galbrena-ascent-enter-demon",
      event: "action-end",
      predicates: [and(actionPredicate(GALBRENA.ascent), not(sequenceAtLeast(6)))],
      operations: [
        { kind: "resource", operation: "consume-all", resourceId: "sinflame" },
        { kind: "resource", operation: "set-max", resourceId: "purging-flame" },
        { kind: "change-form", stateId: "Demon Hypostasis" },
      ],
    },
    {
      id: "galbrena-s6-ascent-enter-eternal",
      event: "action-end",
      predicates: [and(actionPredicate(GALBRENA.ascent), sequenceAtLeast(6))],
      operations: [
        { kind: "resource", operation: "consume-all", resourceId: "sinflame" },
        { kind: "resource", operation: "set-max", resourceId: "purging-flame" },
        { kind: "change-form", stateId: "Eternal Hypostasis" },
      ],
    },
    {
      id: "galbrena-reference-demon-exit",
      event: "custom",
      predicates: [actionPredicate(GALBRENA_DEMON_EXIT_EVENT)],
      operations: [
        { kind: "resource", operation: "consume-all", resourceId: "purging-flame" },
        { kind: "resource", operation: "consume-all", resourceId: "afterflame" },
        { kind: "change-form", stateId: "Threshold State" },
      ],
    },
  ],
};

const afterflame: EffectDefinition = {
  id: "precise-galbrena-afterflame",
  label: "Afterflame · Echo generation / Demon amplification",
  source: { id: "galbrena-afterflame", type: "resonator", label: "Afterflame" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [
    {
      id: "galbrena-afterflame-enhanced-damage",
      label: "Demon Hypostasis · +1.5% DMG per Afterflame, cap +60%",
      accounting: "runtime",
      selectors: [{ kind: "action-id", anyOf: enhancedIds }],
      modifiers: [{
        kind: "damage-amplification",
        stacking: "additive",
        valueExpression: {
          kind: "min",
          values: [constant(60), { kind: "multiply", values: [resource("afterflame"), constant(1.5)] }],
        },
      }],
    },
  ],
  triggers: [
    {
      id: "galbrena-reference-main-echo-afterflame",
      event: "echo-skill",
      predicates: [actionPredicate(GALBRENA_REFERENCE_ECHO_EVENT)],
      maxTriggers: 1,
      triggerCountScope: "owner",
      operations: [{ kind: "resource", operation: "gain", resourceId: "afterflame", amount: constant(8) }],
    },
  ],
};

const liberationWindow: EffectDefinition = {
  id: "precise-galbrena-hellfire-window",
  label: "Hellfire Absolution · Demon multiplier window",
  source: { id: "galbrena-liberation", type: "resonator", label: "Hellfire Absolution" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 14 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [{
    id: "galbrena-hellfire-enhanced-mv",
    label: "+85% DMG Multiplier increase to Demon basic/heavy/mid-air/dodge attacks",
    accounting: "runtime",
    selectors: [{ kind: "action-id", anyOf: liberationBuffIds }],
    modifiers: [{
      kind: "motion-value",
      mode: "relative-additive",
      stacking: "additive",
      value: constant(85),
    }],
  }],
  triggers: [{
    id: "galbrena-hellfire-on-liberation",
    event: "action-end",
    predicates: [actionPredicate(GALBRENA.liberation)],
    operations: [{ kind: "activate-effect", effectId: "precise-galbrena-hellfire-window" }],
  }],
};

const fatedEnd: EffectDefinition = {
  id: "precise-galbrena-fated-end",
  label: "Oathbound Hunt · Fated End",
  source: { id: "galbrena-oathbound-hunt", type: "resonator", label: "Oathbound Hunt" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 5.5 },
    refresh: "no-refresh",
    uniqueness: "refresh-existing",
    stacks: { kind: "independent-expirations", max: 4, initial: 0 },
  },
  rules: [{
    id: "galbrena-fated-end-amplification",
    label: "Fated End · +5% direct Galbrena DMG per stack",
    accounting: "runtime",
    modifiers: [{
      kind: "damage-amplification",
      stacking: "additive",
      valuePerStack: 5,
      maxStacks: 4,
    }],
  }],
  triggers: [
    {
      id: "galbrena-fated-intro",
      event: "action-hit",
      predicates: [actionPredicate(GALBRENA.intro)],
      cooldown: { seconds: 5, scope: "custom", customKey: "galbrena-fated-intro" },
      operations: [
        { kind: "activate-effect", effectId: "precise-galbrena-fated-end" },
        { kind: "gain-stacks", effectId: "precise-galbrena-fated-end", amount: constant(1) },
      ],
    },
    {
      id: "galbrena-fated-basic",
      event: "action-hit",
      predicates: [actionPredicate(
        GALBRENA.basic1, GALBRENA.basic2, GALBRENA.basic3, GALBRENA.basic4,
        GALBRENA.seraphic1, GALBRENA.seraphic2, GALBRENA.seraphic3,
        GALBRENA.seraphic4, GALBRENA.seraphic5,
      )],
      cooldown: { seconds: 5, scope: "custom", customKey: "galbrena-fated-basic" },
      operations: [
        { kind: "activate-effect", effectId: "precise-galbrena-fated-end" },
        { kind: "gain-stacks", effectId: "precise-galbrena-fated-end", amount: constant(1) },
      ],
    },
    {
      id: "galbrena-fated-skill",
      event: "action-hit",
      predicates: [actionPredicate(GALBRENA.encroach, GALBRENA.ascent, GALBRENA.ravage)],
      cooldown: { seconds: 5, scope: "custom", customKey: "galbrena-fated-skill" },
      operations: [
        { kind: "activate-effect", effectId: "precise-galbrena-fated-end" },
        { kind: "gain-stacks", effectId: "precise-galbrena-fated-end", amount: constant(1) },
      ],
    },
    {
      id: "galbrena-fated-liberation",
      event: "action-hit",
      predicates: [actionPredicate(GALBRENA.liberation)],
      cooldown: { seconds: 5, scope: "custom", customKey: "galbrena-fated-liberation" },
      operations: [
        { kind: "activate-effect", effectId: "precise-galbrena-fated-end" },
        { kind: "gain-stacks", effectId: "precise-galbrena-fated-end", amount: constant(1) },
      ],
    },
  ],
};

const sequences: EffectDefinition = {
  id: "precise-galbrena-sequences",
  label: "Galbrena Resonance Chain · personal damage",
  source: { id: "galbrena-chain", type: "resonance-chain", label: "Galbrena Resonance Chain" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [
    {
      id: "galbrena-s1-afterflame-crit",
      label: "S1 · +2% Crit DMG per Afterflame at Ascent, cap +80%",
      accounting: "runtime",
      requiredSequence: 1,
      selectors: [{ kind: "action-id", anyOf: enhancedIds }],
      modifiers: [{
        kind: "crit-damage-bonus",
        stacking: "additive",
        valueExpression: {
          kind: "min",
          values: [constant(80), { kind: "multiply", values: [resource("afterflame"), constant(2)] }],
        },
      }],
    },
    {
      id: "galbrena-s3-liberation-mv",
      label: "S3 · Hellfire Absolution DMG Multiplier +130%",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: [GALBRENA.liberation] }],
      modifiers: [{
        kind: "motion-value",
        mode: "relative-additive",
        stacking: "additive",
        value: constant(130),
      }],
    },
    {
      id: "galbrena-s5-skill-mv",
      label: "S5 · Encroach / Ascent / Ravage DMG Multiplier +150%",
      accounting: "runtime",
      requiredSequence: 5,
      selectors: [{ kind: "action-id", anyOf: [GALBRENA.encroach, GALBRENA.ascent, GALBRENA.ravage] }],
      modifiers: [{
        kind: "motion-value",
        mode: "relative-additive",
        stacking: "additive",
        value: constant(150),
      }],
    },
    {
      id: "galbrena-s6-eternal-mv",
      label: "S6 · Eternal Hypostasis enhanced attack DMG Multiplier +60%",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [{ kind: "action-id", anyOf: liberationBuffIds }],
      modifiers: [{
        kind: "motion-value",
        mode: "relative-additive",
        stacking: "additive",
        value: constant(60),
      }],
    },
    {
      id: "galbrena-s6-afterflame-fusion-amp",
      label: "S6 · +0.875% Fusion DMG Amplification per Afterflame at Ascent, cap +35%",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [{ kind: "action-id", anyOf: enhancedIds }],
      modifiers: [{
        kind: "damage-amplification",
        stacking: "additive",
        valueExpression: {
          kind: "min",
          values: [constant(35), { kind: "multiply", values: [resource("afterflame"), constant(0.875)] }],
        },
      }],
    },
  ],
};

const s4ReferenceTeam: EffectDefinition = {
  id: "precise-galbrena-s4-reference-team",
  label: "S4 · reference-team Echo window",
  source: { id: "galbrena-s4", type: "resonance-chain", label: "Carry Forth This Fading Spark" },
  target: "team",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "fixed", seconds: 20 }, uniqueness: "replace-existing" },
  rules: [{
    id: "galbrena-s4-all-attribute",
    label: "S4 · +20% all-Attribute DMG Bonus after team Echo cast",
    accounting: "runtime",
    requiredSequence: 4,
    modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 20 }],
  }],
};

const combatEffect = (
  id: string,
  name: string,
  trigger: string,
  structuredEffect: EffectDefinition,
): CombatEffect => ({
  id,
  name,
  sourceId: structuredEffect.source.id,
  trigger,
  target: structuredEffect.target === "team" ? "team" : "self",
  effect: structuredEffect.label,
  source,
  structuredEffect,
});

export const galbrenaScenarioEffects: readonly EffectDefinition[] = [
  s4ReferenceTeam,
];

export function applyPreciseGalbrenaMechanics(resonator: Resonator): Resonator {
  if (resonator.id !== "galbrena" || !resonator.combat) return resonator;
  const effects: readonly CombatEffect[] = [
    combatEffect("galbrena-burning-drive", "Burning Drive", "Intro / Skill / Seraphic 4", burningDrive),
    combatEffect("galbrena-state-machine", "Threshold / Demon state machine", "Ascent / depletion", stateMachine),
    combatEffect("galbrena-afterflame", "Afterflame", "team Echo / Demon state", afterflame),
    combatEffect("galbrena-hellfire", "Hellfire Absolution window", "Liberation", liberationWindow),
    combatEffect("galbrena-fated-end", "Fated End", "skill types on hit", fatedEnd),
    combatEffect("galbrena-sequences", "Galbrena sequence damage", "sequence", sequences),
  ];
  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      forms: ["Threshold State", "Demon Hypostasis", "Eternal Hypostasis"],
      defaultForm: "Threshold State",
      resources: galbrenaResources,
      effects: [...resonator.combat.effects, ...effects],
      unknowns: [
        ...resonator.combat.unknowns,
        "Sinflame and Purging Flame per-hit numeric deltas are not exposed by the promoted GameDatabase/public kit. The exact standard scenario therefore owns the verified 100-point Ascent checkpoint and final depletion endpoint without inventing per-hit costs.",
        "Afterflame from allied Echo casts is scenario/team-context data. The Prydwen reference setup enters Galbrena with two distinct allied Echo casts (16 Afterflame), then Galbrena's own Main Echo adds 8 before Ascent.",
      ],
    },
  };
}

const luxHeavyWindow: EffectDefinition = {
  id: "precise-lux-umbra-heavy-window",
  label: "To Fire She Returns · Heavy Attack amplification",
  source: { id: "precise-galbrena-signature", type: "weapon", label: "Lux & Umbra" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "fixed", seconds: 6 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
  rules: [{
    id: "lux-umbra-heavy-amplification",
    label: "Echo Skill DMG dealt · Heavy Attack DMG Amplification",
    accounting: "runtime",
    selectors: [{ kind: "damage-type", anyOf: ["heavyAttack"] }],
    modifiers: [{ kind: "damage-amplification", stacking: "additive", valueExpression: rank([24, 30, 36, 42, 48]) }],
  }],
  triggers: [{
    id: "lux-umbra-heavy-window-on-echo",
    event: "damage-dealt",
    predicates: [{ kind: "identity", field: "damageType", anyOf: ["echoSkill"] }],
    operations: [{ kind: "activate-effect", effectId: "precise-lux-umbra-heavy-window" }],
  }],
};

const luxEchoWindow: EffectDefinition = {
  id: "precise-lux-umbra-echo-window",
  label: "To Fire She Returns · Echo Skill amplification",
  source: { id: "precise-galbrena-signature", type: "weapon", label: "Lux & Umbra" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "fixed", seconds: 6 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
  rules: [{
    id: "lux-umbra-echo-amplification",
    label: "Heavy Attack DMG dealt · Echo Skill DMG Amplification",
    accounting: "runtime",
    selectors: [{ kind: "damage-type", anyOf: ["echoSkill"] }],
    modifiers: [{ kind: "damage-amplification", stacking: "additive", valueExpression: rank([24, 30, 36, 42, 48]) }],
  }],
  triggers: [{
    id: "lux-umbra-echo-window-on-heavy",
    event: "damage-dealt",
    predicates: [{ kind: "identity", field: "damageType", anyOf: ["heavyAttack"] }],
    operations: [{ kind: "activate-effect", effectId: "precise-lux-umbra-echo-window" }],
  }],
};

const luxBothWindows: EffectDefinition = {
  id: "precise-lux-umbra-both-windows",
  label: "To Fire She Returns · dual-window DEF Ignore",
  source: { id: "precise-galbrena-signature", type: "weapon", label: "Lux & Umbra" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [{
    id: "lux-umbra-defense-ignore",
    label: "Both Heavy/Echo amplification windows active · DEF Ignore",
    accounting: "runtime",
    predicates: [{
      kind: "and",
      predicates: [
        { kind: "has-effect", id: "precise-lux-umbra-heavy-window" },
        { kind: "has-effect", id: "precise-lux-umbra-echo-window" },
      ],
    }],
    modifiers: [{ kind: "defense-ignore", stacking: "additive", valueExpression: rank([8, 10, 12, 14, 16]) }],
  }],
};

const luxPermanent: EffectDefinition = {
  id: "precise-lux-umbra-permanent",
  label: "To Fire She Returns · ATK",
  source: { id: "precise-galbrena-signature", type: "weapon", label: "Lux & Umbra" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [{
    id: "lux-umbra-atk",
    label: "R1-R5 · +12/15/18/21/24% ATK",
    accounting: "already-in-final-stats",
    modifiers: [{
      kind: "runtime-stat",
      stat: "attack",
      mode: "percent",
      stacking: "additive",
      value: rank([12, 15, 18, 21, 24]),
    }],
  }],
};

const weaponEffect = (
  id: string,
  name: string,
  trigger: string,
  structuredEffect: EffectDefinition,
): CombatEffect => ({
  id,
  name,
  sourceId: structuredEffect.source.id,
  trigger,
  target: "self",
  effect: structuredEffect.label,
  source,
  structuredEffect,
});

export function applyPreciseGalbrenaWeaponMechanics(
  resonatorId: string,
  weapon: Weapon,
): Weapon {
  if (resonatorId !== "galbrena") return weapon;
  return {
    ...weapon,
    level90Stats: {
      ...weapon.level90Stats!,
      baseAttack: 587.5,
      displayBaseAttack: 588,
    },
    effects: [
      ...(weapon.effects ?? []),
      weaponEffect("lux-umbra-permanent", "Lux & Umbra ATK", "permanent", luxPermanent),
      weaponEffect("lux-umbra-heavy-window", "Lux & Umbra Heavy window", "Echo Skill damage", luxHeavyWindow),
      weaponEffect("lux-umbra-echo-window", "Lux & Umbra Echo window", "Heavy Attack damage", luxEchoWindow),
      weaponEffect("lux-umbra-both", "Lux & Umbra dual-window DEF Ignore", "both windows", luxBothWindows),
    ],
    passiveDescription:
      "R1-R5 structuré: ATK permanent reste upstream dans finalStats; Heavy/Echo amplifications 6s sont runtime; dual-window DEF Ignore est normalisé vers le ratio attendu par le Damage Engine.",
  };
}
