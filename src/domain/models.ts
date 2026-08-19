import type { EffectDefinition } from "./effect-models";
import type { CoordinatedResponseDefinition } from "./coordinated-response-engine";

export const elements = [
  "aero",
  "glacio",
  "electro",
  "fusion",
  "havoc",
  "spectro",
] as const;
export type Element = (typeof elements)[number];

export const weaponTypes = [
  "broadblade",
  "gauntlets",
  "pistols",
  "rectifier",
  "sword",
] as const;
export type WeaponType = (typeof weaponTypes)[number];

export const skillTypes = [
  "basicAttack",
  "resonanceSkill",
  "forteCircuit",
  "resonanceLiberation",
  "introSkill",
] as const;
export type SkillType = (typeof skillTypes)[number];

/** Damage categories that own a permanent FinalStats damage-bonus channel. */
export const damageBonusTypes = [
  "basicAttack",
  "heavyAttack",
  "resonanceSkill",
  "resonanceLiberation",
  "introSkill",
  "echoSkill",
] as const;

/**
 * Standard formula damage categories. Outro damage is intentionally neutral: it
 * receives element/all-DMG/amplification/crit/DEF/RES modifiers, but has no
 * dedicated permanent damage-type-bonus stat unless the game explicitly adds one.
 */
export const damageTypes = [...damageBonusTypes, "outroSkill"] as const;

export type Sequence = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Rarity = 4 | 5;
export type TalentLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export interface MotionValueGroup { percent: number; hits: number; }
export interface ScaledOutcomeFormula { scalingAttribute: "attack" | "hp" | "defense"; percent: number; flat: number; }
export interface ActionOutcomeDefinition {
  healingByTalentLevel?: Readonly<Partial<Record<TalentLevel, ScaledOutcomeFormula>>>;
  shieldByTalentLevel?: Readonly<Partial<Record<TalentLevel, ScaledOutcomeFormula>>>;
  shieldDurationSeconds?: number;
  target: "self" | "nearby-resonators";
}
export type ActionResourceStage = "before-action" | "after-action";
export interface ActionResourceOperation {
  resourceId: string; operation: "consume" | "gain"; amount: number; stage: ActionResourceStage;
  /** Sparse exact replacement amounts gated by Resonance Sequence; never interpolated. */
  amountBySequence?: Readonly<Partial<Record<Sequence, number>>>;
}

export const confidenceLevels = [
  "verified-game-data",
  "multi-source-verified",
  "community-recommendation",
  "community-calculation",
  "disputed",
  "unknown",
  "technical-fixture",
] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];

export interface SourceMetadata {
  kind: ConfidenceLevel;
  source: string;
  url?: string;
  gameVersion?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface DataValue<T> {
  value: T | null;
  confidence: ConfidenceLevel;
  sourceNote?: string;
}

export interface CombatResource {
  id: string;
  name: string;
  cap: number;
  /** Sparse exact cap replacements gated by Resonance Sequence; the highest applicable Sequence wins. */
  capBySequence?: Readonly<Partial<Record<Sequence, number>>>;
  naturalRegeneration?: DataValue<number>;
  notes: readonly string[];
  /** Game-rule meaning; runtime logic must not infer this from the resource id. */
  semantic?: "concerto-energy" | "resonance-energy" | "character-resource" | "system-resource";
}

export interface CombatAction {
  id: string;
  name: string;
  talent: SkillType | "outroSkill" | "echoSkill";
  variant?: string;
  requiredForm?: string;
  requiredState?: readonly string[];
  damageType?: (typeof damageTypes)[number] | "tuneRupture";
  conditionalDamageType?: {
    damageType: (typeof damageTypes)[number];
    condition: string;
  };
  scaling?: "damage" | "tuneAmp";
  /** Damage scaling is data-owned per action; ordinary character attacks default to ATK. */
  scalingAttribute?: "attack" | "hp" | "defense";
  /** Default/authoring level. Exact alternate levels are sparse and never interpolated. */
  level: TalentLevel;
  multipliers: readonly MotionValueGroup[];
  multipliersByTalentLevel?: Readonly<Partial<Record<TalentLevel, readonly MotionValueGroup[]>>>;
  outcomes?: ActionOutcomeDefinition;
  /** Only verified execution stages belong here; unknown legacy costs/gains stay diagnostic-only. */
  resourceOperations?: readonly ActionResourceOperation[];
  costs?: ReadonlyArray<{ resource: string; amount: number | null }>;
  gains?: ReadonlyArray<{ resource: string; amount: number | null }>;
  cooldownSeconds?: number;
  castDurationSeconds: DataValue<number>;
  recoverySeconds: DataValue<number>;
  hitTimingsSeconds: DataValue<readonly number[]>;
  cancel?: { into: readonly string[]; timing: DataValue<number> };
  notes?: readonly string[];
  source: SourceMetadata;
}

export interface CombatEffect {
  id: string;
  name: string;
  sourceId: string;
  trigger: string;
  target: "self" | "team" | "other-team-members" | "enemy";
  effect: string;
  value?: number;
  valueType?:
    | "damage-bonus"
    | "damage-amplification"
    | "crit-rate"
    | "crit-damage"
    | "def-ignore"
    | "res-ignore"
    | "shield-atk-scaling";
  maxStacks?: number;
  stackRule?: string;
  durationSeconds?: number | null;
  refreshRule?: string;
  resetRule?: string;
  endCondition?: string;
  cooldownSeconds?: number;
  internalCooldown?: {
    seconds: number;
    scope: "target" | "action-and-target";
  };
  source: SourceMetadata;
  /** Optional deterministic rules; legacy human-readable fields remain supported. */
  structuredEffect?: EffectDefinition;
}

export interface CombatRotation {
  id: string;
  name: string;
  sequence: Sequence;
  policy: "no-quickswap";
  steps: readonly string[];
  totalDurationSeconds: DataValue<number>;
  notes: readonly string[];
  source: SourceMetadata;
}

export interface ResonatorCombatData {
  /** Legacy capability marker retained for Lv10-only data sets such as Aemeath. */
  level10Only: boolean;
  forms: readonly string[];
  /** Verified initial runtime form; capability arrays are never current state. */
  defaultForm?: string;
  modes: readonly string[];
  resources: readonly CombatResource[];
  actions: readonly CombatAction[];
  effects: readonly CombatEffect[];
  coordinatedResponses?: readonly CoordinatedResponseDefinition[];
  rotations: readonly CombatRotation[];
  unknowns: readonly string[];
  source: SourceMetadata;
}

export interface Resonator {
  id: string;
  name: string;
  element: Element;
  weaponType: WeaponType;
  rarity: Rarity;
  role?: string;
  baseStats?: ReadonlyArray<{
    level: number;
    hp: number;
    attack: number;
    defense: number;
    displayDefense?: number;
    critRate?: number;
    critDamage?: number;
    energyRegen?: number;
  }>;
  minorFortes?: readonly string[];
  portrait?: { src: `/${string}`; alt: string; attribution?: string };
  skillNames: Readonly<Record<SkillType, string>>;
  resonanceChain: ReadonlyArray<{
    sequence: Exclude<Sequence, 0>;
    name: string;
    description: string;
  }>;
  combat?: ResonatorCombatData;
  source: SourceMetadata;
}

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  rarity: Rarity;
  level90Stats?: { baseAttack: number; displayBaseAttack?: number; critRate?: number; energyRegen?: number };
  effects?: readonly CombatEffect[];
  passiveDescription?: string;
  source: SourceMetadata;
}

export interface Sonata {
  id: string;
  name: string;
  effectDescription?: string;
  effects?: readonly CombatEffect[];
  source: SourceMetadata;
}

export interface MainEcho {
  id: string;
  name: string;
  sonataIds: readonly string[];
  skillDescription?: string;
  action?: CombatAction;
  effects?: readonly CombatEffect[];
  source: SourceMetadata;
}

export interface FinalStats {
  hp: number;
  attack: number;
  defense: number;
  critRate: number;
  critDamage: number;
  energyRegen: number;
  healingBonus: number;
  /** Permanent Tune Break Boost, expressed in percentage points. */
  tuneBreakBoost: number;
  elementalDamageBonus: Record<Element, number>;
  damageTypeBonus: Record<(typeof damageBonusTypes)[number], number>;
}
