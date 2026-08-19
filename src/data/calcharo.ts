import { generatedCharacterBoxRosterBaselines10R1 } from "@/generated/character-box-roster-baselines-10r1";
import { generatedCommunityEchoPresets10R1 } from "@/generated/community-echo-presets-10r1";
import { applyEchoLoadoutStatsV1 } from "@/game-data/echo-loadout-stats";
import type {
  CombatAction,
  CombatEffect,
  MainEcho,
  RecommendedBuildPreset,
  Resonator,
  Sonata,
  SourceMetadata,
  Weapon,
} from "@/domain/models";
import type { EffectDefinition } from "@/domain/effect-models";

export const calcharoSource: SourceMetadata = {
  kind: "multi-source-verified",
  source: "Wuthering Waves Wiki/Fandom; Wuwa Wiki; Prydwen; WUWA GameDatabase V1",
  gameVersion: "3.x current",
  verifiedAt: "2026-08-19",
  notes:
    "Lv90/Lv10 combat values and personal mechanics cross-checked across current sources. Personal simulation uses the universal theoretical timing policy, never character-specific measured frames.",
};

const unknown = () => ({ value: null, confidence: "unknown" as const });
const action = (
  value: Omit<
    CombatAction,
    "level" | "castDurationSeconds" | "recoverySeconds" | "hitTimingsSeconds" | "source"
  >,
): CombatAction => ({
  ...value,
  level: 10,
  castDurationSeconds: unknown(),
  recoverySeconds: unknown(),
  hitTimingsSeconds: unknown(),
  source: calcharoSource,
});

export const calcharoActions: readonly CombatAction[] = [
  action({ id: "calcharo-basic-1", name: "Gnawing Fangs: Stage 1", talent: "basicAttack", damageType: "basicAttack", multipliers: [{ percent: 45.73, hits: 2 }] }),
  action({ id: "calcharo-basic-2", name: "Gnawing Fangs: Stage 2", talent: "basicAttack", damageType: "basicAttack", multipliers: [{ percent: 99.41, hits: 1 }] }),
  action({ id: "calcharo-basic-3", name: "Gnawing Fangs: Stage 3", talent: "basicAttack", damageType: "basicAttack", multipliers: [{ percent: 85.18, hits: 1 }, { percent: 42.59, hits: 3 }] }),
  action({ id: "calcharo-basic-4", name: "Gnawing Fangs: Stage 4", talent: "basicAttack", damageType: "basicAttack", multipliers: [{ percent: 79.51, hits: 2 }, { percent: 106.01, hits: 1 }] }),
  action({ id: "calcharo-heavy", name: "Gnawing Fangs: Heavy Attack", talent: "basicAttack", damageType: "heavyAttack", multipliers: [{ percent: 41.36, hits: 5 }], costs: [{ resource: "stamina", amount: 30 }] }),
  action({ id: "calcharo-midair", name: "Gnawing Fangs: Mid-air Attack", talent: "basicAttack", damageType: "basicAttack", multipliers: [{ percent: 123.27, hits: 1 }], costs: [{ resource: "stamina", amount: 30 }] }),
  action({ id: "calcharo-dodge", name: "Gnawing Fangs: Dodge Counter", talent: "basicAttack", damageType: "basicAttack", multipliers: [{ percent: 66.48, hits: 3 }, { percent: 85.47, hits: 1 }] }),

  action({ id: "calcharo-skill-1", name: "Extermination Order: Part 1", talent: "resonanceSkill", damageType: "resonanceSkill", multipliers: [{ percent: 51.57, hits: 2 }, { percent: 68.76, hits: 1 }], cooldownSeconds: 10, gains: [{ resource: "cruelty", amount: 1 }, { resource: "concerto", amount: 4 }] }),
  action({ id: "calcharo-skill-2", name: "Extermination Order: Part 2", talent: "resonanceSkill", damageType: "resonanceSkill", multipliers: [{ percent: 77.36, hits: 2 }, { percent: 103.14, hits: 1 }], gains: [{ resource: "cruelty", amount: 1 }, { resource: "concerto", amount: 4 }] }),
  action({ id: "calcharo-skill-3", name: "Extermination Order: Part 3", talent: "resonanceSkill", damageType: "resonanceSkill", multipliers: [{ percent: 214.87, hits: 2 }], gains: [{ resource: "cruelty", amount: 1 }, { resource: "concerto", amount: 4 }] }),

  action({ id: "calcharo-mercy", name: "Hunting Mission: Mercy", talent: "forteCircuit", damageType: "heavyAttack", multipliers: [{ percent: 39.11, hits: 8 }, { percent: 78.22, hits: 1 }], costs: [{ resource: "cruelty", amount: 3 }], gains: [{ resource: "resonance-energy", amount: 6 }, { resource: "concerto", amount: 6 }] }),
  action({ id: "calcharo-liberation", name: "Phantom Etching", talent: "resonanceLiberation", damageType: "resonanceLiberation", multipliers: [{ percent: 596.43, hits: 1 }], cooldownSeconds: 20, costs: [{ resource: "resonance-energy", amount: 125 }], gains: [{ resource: "concerto", amount: 20 }], notes: ["Enters Deathblade Gear for 11 seconds; personal rotation data selects the transformed actions explicitly."] }),
  action({ id: "calcharo-necessary-means", name: "Necessary Means", talent: "resonanceLiberation", damageType: "introSkill", multipliers: [{ percent: 198.81, hits: 2 }], notes: ["Replacement Intro after Deathblade Gear; its multiplier is owned by the Liberation talent table."] }),
  action({ id: "calcharo-hounds-1", name: "Hounds Roar: Stage 1", talent: "resonanceLiberation", damageType: "basicAttack", multipliers: [{ percent: 88.07, hits: 1 }], gains: [{ resource: "killing-intent", amount: 1 }] }),
  action({ id: "calcharo-hounds-2", name: "Hounds Roar: Stage 2", talent: "resonanceLiberation", damageType: "basicAttack", multipliers: [{ percent: 35.23, hits: 2 }, { percent: 52.84, hits: 2 }], gains: [{ resource: "killing-intent", amount: 1 }] }),
  action({ id: "calcharo-hounds-3", name: "Hounds Roar: Stage 3", talent: "resonanceLiberation", damageType: "basicAttack", multipliers: [{ percent: 163.84, hits: 1 }], gains: [{ resource: "killing-intent", amount: 1 }] }),
  action({ id: "calcharo-hounds-4", name: "Hounds Roar: Stage 4", talent: "resonanceLiberation", damageType: "basicAttack", multipliers: [{ percent: 34.82, hits: 6 }], gains: [{ resource: "killing-intent", amount: 1 }] }),
  action({ id: "calcharo-hounds-5", name: "Hounds Roar: Stage 5", talent: "resonanceLiberation", damageType: "basicAttack", multipliers: [{ percent: 150.19, hits: 2 }], gains: [{ resource: "killing-intent", amount: 1 }] }),
  action({ id: "calcharo-deathblade-heavy", name: "Deathblade Gear: Heavy Attack", talent: "resonanceLiberation", damageType: "resonanceLiberation", multipliers: [{ percent: 62.03, hits: 5 }], costs: [{ resource: "stamina", amount: 30 }] }),
  action({ id: "calcharo-deathblade-dodge", name: "Deathblade Gear: Dodge Counter", talent: "resonanceLiberation", damageType: "resonanceLiberation", multipliers: [{ percent: 56.99, hits: 6 }] }),
  action({ id: "calcharo-death-messenger", name: "Hunting Mission: Death Messenger", talent: "forteCircuit", damageType: "resonanceLiberation", multipliers: [{ percent: 97.77, hits: 8 }, { percent: 195.53, hits: 1 }], costs: [{ resource: "killing-intent", amount: 5 }], gains: [{ resource: "resonance-energy", amount: 5 }, { resource: "concerto", amount: 10 }] }),
  action({ id: "calcharo-intro", name: "Wanted Outlaw", talent: "introSkill", damageType: "introSkill", multipliers: [{ percent: 39.77, hits: 2 }, { percent: 59.65, hits: 2 }], gains: [{ resource: "concerto", amount: 10 }] }),
  action({ id: "calcharo-s6-phantom", name: "S6 Death Messenger Phantom", talent: "forteCircuit", damageType: "resonanceLiberation", multipliers: [{ percent: 100, hits: 1 }], notes: ["Each S6 phantom is emitted independently; two are emitted per Death Messenger."] }),
];

const source = (
  id: string,
  type: EffectDefinition["source"]["type"] = "resonator",
) => ({ id, type, label: id, metadata: calcharoSource });
const legacy = (
  id: string,
  name: string,
  effect: string,
  target: CombatEffect["target"] = "self",
): CombatEffect => ({ id, name, sourceId: id, trigger: name, target, effect, source: calcharoSource });
const structured = (
  definition: EffectDefinition,
  description: string,
): CombatEffect => ({
  ...legacy(definition.id, definition.label, description, definition.target === "enemy" ? "enemy" : definition.target === "team" ? "team" : "self"),
  structuredEffect: definition,
});

const skillIds = ["calcharo-skill-1", "calcharo-skill-2", "calcharo-skill-3"] as const;

export const calcharoEffects: readonly CombatEffect[] = [
  structured({
    id: "calcharo-bloodshed-awaken",
    label: "Bloodshed Awaken",
    source: source("calcharo"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: { duration: { kind: "fixed", seconds: 15 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
    rules: [{ id: "bloodshed-lib", label: "+10% Liberation DMG", accounting: "runtime", selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }], modifiers: [{ kind: "damage-type-bonus", stacking: "additive", value: 10 }] }],
    triggers: [{ id: "bloodshed-mercy", event: "action-start", predicates: [{ kind: "identity", field: "actionId", anyOf: ["calcharo-mercy"] }], operations: [{ kind: "activate-effect", effectId: "calcharo-bloodshed-awaken" }] }],
  }, "Mercy grants +10% Resonance Liberation DMG for 15s."),
  structured({
    id: "calcharo-sequence-personal",
    label: "Calcharo Sequence personal effects",
    source: source("calcharo-sequence", "resonance-chain"),
    target: "self",
    activationPolicy: "initially-active",
    rules: [
      { id: "calcharo-s5-intro", label: "S5 Intro damage", accounting: "runtime", requiredSequence: 5, selectors: [{ kind: "action-id", anyOf: ["calcharo-intro", "calcharo-necessary-means"] }], modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 50 }] },
    ],
    triggers: [{
      id: "calcharo-s1-energy",
      event: "action-hit",
      predicates: [{ kind: "identity", field: "actionId", anyOf: skillIds }],
      cooldown: { seconds: 20, scope: "owner" },
      operations: [{ kind: "resource", operation: "gain", resourceId: "resonance-energy", amount: { kind: "constant", value: 10 } }],
    }],
  }, "S1 energy and S5 Intro personal damage; team-only S4 is stored separately."),
  structured({
    id: "calcharo-s2-skill-bonus",
    label: "S2 Resonance Skill DMG Bonus",
    source: source("calcharo-sequence", "resonance-chain"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: { duration: { kind: "fixed", seconds: 15 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
    rules: [{ id: "s2-skill", label: "+30% Skill DMG", accounting: "runtime", requiredSequence: 2, selectors: [{ kind: "damage-type", anyOf: ["resonanceSkill"] }], modifiers: [{ kind: "damage-type-bonus", stacking: "additive", value: 30 }] }],
    triggers: [{ id: "s2-intro", event: "action-start", predicates: [{ kind: "identity", field: "actionId", anyOf: ["calcharo-intro", "calcharo-necessary-means"] }], operations: [{ kind: "activate-effect", effectId: "calcharo-s2-skill-bonus" }] }],
  }, "S2: Intro grants +30% Resonance Skill DMG for 15s."),
  structured({
    id: "calcharo-s3-deathblade-electro",
    label: "S3 Deathblade Gear Electro DMG",
    source: source("calcharo-sequence", "resonance-chain"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: { duration: { kind: "fixed", seconds: 11 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
    rules: [{ id: "s3-electro", label: "+25% Electro DMG", accounting: "runtime", requiredSequence: 3, modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 25 }] }],
    triggers: [{ id: "s3-liberation", event: "action-start", predicates: [{ kind: "identity", field: "actionId", anyOf: ["calcharo-liberation"] }], operations: [{ kind: "activate-effect", effectId: "calcharo-s3-deathblade-electro" }] }],
  }, "S3: +25% Electro DMG during Deathblade Gear."),
  structured({
    id: "calcharo-s6-phantoms",
    label: "S6 Death Messenger Phantoms",
    source: source("calcharo-sequence", "resonance-chain"),
    target: "self",
    activationPolicy: "triggered",
    rules: [{ id: "s6-gate", label: "S6 phantom emission", accounting: "informational", requiredSequence: 6, modifiers: [] }],
    triggers: [{ id: "s6-death-messenger", event: "action-start", predicates: [{ kind: "identity", field: "actionId", anyOf: ["calcharo-death-messenger"] }], operations: [
      { kind: "emit-action", action: { actionId: "calcharo-s6-phantom", attribution: "coordinated", snapshot: { stats: "hit", stacks: "tick" } } },
      { kind: "emit-action", action: { actionId: "calcharo-s6-phantom", attribution: "coordinated", snapshot: { stats: "hit", stacks: "tick" } } },
    ] }],
  }, "S6: two 100% ATK Liberation-damage phantoms per Death Messenger."),
  { ...legacy("calcharo-s4-team", "S4 Shadowy Raid team Electro", "After Outro, nearby team members gain +20% Electro DMG for 30s.", "team") },
];

export const lustrousRazor: Weapon = {
  id: "lustrous-razor",
  name: "Lustrous Razor",
  type: "broadblade",
  rarity: 5,
  level90Stats: { baseAttack: 587.5, displayBaseAttack: 587 },
  passiveDescription: "R1: +12.8% Energy Regen. Casting Resonance Skill grants +7% Resonance Liberation DMG per stack, up to 3 stacks for 12s.",
  effects: [structured({
    id: "lustrous-r1-liberation",
    label: "Lustrous Razor R1 — Liberation stacks",
    source: source("lustrous-razor", "weapon"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: { duration: { kind: "fixed", seconds: 12 }, refresh: "reset-duration", uniqueness: "refresh-existing", stacks: { kind: "shared", max: 3, initial: 0 } },
    rules: [{ id: "lustrous-lib", label: "+7% Liberation DMG per stack", accounting: "runtime", selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }], modifiers: [{ kind: "damage-type-bonus", stacking: "additive", valuePerStack: 7, maxStacks: 3 }] }],
    triggers: [{ id: "lustrous-skill", event: "action-start", predicates: [{ kind: "identity", field: "actionId", anyOf: skillIds }], operations: [{ kind: "activate-effect", effectId: "lustrous-r1-liberation" }, { kind: "gain-stacks", effectId: "lustrous-r1-liberation", amount: { kind: "constant", value: 1 } }] }],
  }, "Each Resonance Skill cast grants one R1 Liberation stack for 12s.")],
  source: calcharoSource,
};

export const voidThunder: Sonata = {
  id: "void-thunder",
  name: "Void Thunder",
  effectDescription: "2-piece: +10% Electro DMG. 5-piece: Heavy Attack or Resonance Skill grants +15% Electro DMG, up to 2 stacks, 15s each.",
  effects: [
    structured({ id: "void-thunder-2pc", label: "Void Thunder 2-piece", source: source("void-thunder", "sonata"), target: "self", activationPolicy: "initially-active", rules: [{ id: "void-2pc-electro", label: "+10% Electro DMG", accounting: "runtime", modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 10 }] }] }, "Always-on 2-piece Electro bonus."),
    structured({
      id: "void-thunder-5pc",
      label: "Void Thunder 5-piece",
      source: source("void-thunder", "sonata"),
      target: "self",
      activationPolicy: "triggered",
      lifecycle: { duration: { kind: "fixed", seconds: 15 }, refresh: "reset-duration", uniqueness: "refresh-existing", stacks: { kind: "shared", max: 2, initial: 0 } },
      rules: [{ id: "void-5pc-electro", label: "+15% Electro per stack", accounting: "runtime", modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", valuePerStack: 15, maxStacks: 2 }] }],
      triggers: [{ id: "void-heavy-skill", event: "action-start", predicates: [{ kind: "identity", field: "actionId", anyOf: [...skillIds, "calcharo-heavy", "calcharo-mercy", "calcharo-deathblade-heavy", "calcharo-death-messenger"] }], operations: [{ kind: "activate-effect", effectId: "void-thunder-5pc" }, { kind: "gain-stacks", effectId: "void-thunder-5pc", amount: { kind: "constant", value: 1 } }] }],
    }, "Heavy Attack or Resonance Skill builds the 5-piece Electro stacks."),
  ],
  source: calcharoSource,
};

const nightmareAction = action({ id: "nightmare-thundering-mephis", name: "Nightmare: Thundering Mephis", talent: "echoSkill", damageType: "echoSkill", multipliers: [{ percent: 405, hits: 1 }], cooldownSeconds: 25 });
export const nightmareThunderingMephis: MainEcho = {
  id: "nightmare-thundering-mephis",
  name: "Nightmare: Thundering Mephis",
  sonataIds: ["void-thunder"],
  action: nightmareAction,
  skillDescription: "Deals 405% Electro DMG. Main-slot passive grants +12% Electro DMG and +12% Resonance Liberation DMG.",
  effects: [structured({ id: "nightmare-thundering-main", label: "Nightmare: Thundering Mephis main-slot", source: source("nightmare-thundering-mephis", "echo"), target: "self", activationPolicy: "initially-active", rules: [
    { id: "nightmare-electro", label: "+12% Electro DMG", accounting: "runtime", modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 12 }] },
    { id: "nightmare-liberation", label: "+12% Liberation DMG", accounting: "runtime", selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }], modifiers: [{ kind: "damage-type-bonus", stacking: "additive", value: 12 }] },
  ] }, "Main-slot passive bonuses.")],
  source: calcharoSource,
};

export const calcharo: Resonator = {
  id: "calcharo",
  name: "Calcharo",
  element: "electro",
  weaponType: "broadblade",
  rarity: 5,
  role: "Main DPS",
  baseStats: [{ level: 90, hp: 10500, attack: 437.5, defense: 1185.53, displayDefense: 1186, critRate: 5, critDamage: 150, energyRegen: 100 }],
  minorFortes: ["CRIT DMG +16%", "ATK +12%"],
  skillNames: { basicAttack: "Gnawing Fangs", resonanceSkill: "Extermination Order", forteCircuit: "Hunting Mission", resonanceLiberation: "Phantom Etching", introSkill: "Wanted Outlaw" },
  resonanceChain: [
    { sequence: 1, name: "S1", description: "Extermination Order hit restores 10 Resonance Energy; 20s cooldown." },
    { sequence: 2, name: "S2", description: "Intro/Necessary Means grants +30% Resonance Skill DMG for 15s." },
    { sequence: 3, name: "S3", description: "Deathblade Gear grants +25% Electro DMG." },
    { sequence: 4, name: "S4", description: "Outro grants nearby team members +20% Electro DMG for 30s." },
    { sequence: 5, name: "S5", description: "Wanted Outlaw and Necessary Means deal 50% more damage." },
    { sequence: 6, name: "S6", description: "Death Messenger summons two 100% ATK phantoms dealing Liberation damage." },
  ],
  combat: {
    level10Only: true,
    forms: ["Normal", "Deathblade Gear"],
    defaultForm: "Normal",
    modes: [],
    resources: [
      { id: "cruelty", name: "Cruelty", cap: 3, semantic: "character-resource", notes: ["One point is gained per Extermination Order part that hits."] },
      { id: "killing-intent", name: "Killing Intent", cap: 5, semantic: "character-resource", notes: ["One point is gained per Hounds Roar attack stage that hits in the practical rotation model."] },
      { id: "resonance-energy", name: "Resonance Energy", cap: 125, semantic: "resonance-energy", notes: [] },
      { id: "concerto", name: "Concerto Energy", cap: 100, semantic: "concerto-energy", notes: [] },
    ],
    actions: calcharoActions,
    effects: calcharoEffects,
    rotations: [],
    unknowns: ["Personal timings intentionally use the universal theoretical timing policy.", "Exact lower-than-Lv10 talent tables are not promoted in this first Calcharo checkpoint."],
    source: calcharoSource,
  },
  source: calcharoSource,
};

const generatedEcho = generatedCommunityEchoPresets10R1.calcharo.echoLoadout;
const baseline = generatedCharacterBoxRosterBaselines10R1.calcharo;
const withEchoes = applyEchoLoadoutStatsV1(
  baseline,
  { hp: 10500, attack: 437.5 + 587.5, defense: 1185.53 },
  generatedEcho,
).finalStats;
const calcharoFinalStats = {
  ...withEchoes,
  attack: withEchoes.attack + (437.5 + 587.5) * 0.12,
  critDamage: withEchoes.critDamage + 16,
  energyRegen: withEchoes.energyRegen + 12.8,
};

export const calcharoPreset: RecommendedBuildPreset = {
  id: "calcharo-s0-l90-lustrous-void-thunder",
  resonatorId: "calcharo",
  label: "Calcharo S0 Lv90 · Lustrous Razor · Void Thunder",
  role: calcharo.role,
  characterLevel: 90,
  sequence: 0,
  skillLevels: { basicAttack: 10, resonanceSkill: 10, forteCircuit: 10, resonanceLiberation: 10, introSkill: 10 },
  progression: { inherentSkillsUnlocked: true, minorFortesUnlocked: true },
  weapon: { weaponId: "lustrous-razor", level: 90, rank: 1 },
  finalStats: calcharoFinalStats,
  echoLoadout: generatedEcho,
  sonataId: "void-thunder",
  mainEchoId: "nightmare-thundering-mephis",
  notes: [
    "Permanent panel stats include the exact curated Echo main/substats, Calcharo minor Fortes and Lustrous Razor R1 Energy Regen exactly once.",
    "Void Thunder and Nightmare: Thundering Mephis damage bonuses are runtime effects and are not double-counted in finalStats.",
    "Personal timing uses the shared theoretical WUWA LAB profile policy.",
  ],
  source: calcharoSource,
};
