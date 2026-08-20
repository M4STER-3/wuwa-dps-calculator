import type { CombatAction, SourceMetadata } from "@/domain/models";

type PreciseAction = CombatAction & {
  readonly sourceAttributeId?: string;
  readonly sourceSkillId?: string;
  readonly sourceSkillName?: string;
  readonly sourceSkillType?: string;
};

export const SHOREKEEPER_NATIVE = {
  basic1: "precise-shorekeeper-attr-1505001",
  basic2: "precise-shorekeeper-attr-1505002",
  basic3: "precise-shorekeeper-attr-1505003",
  basic4: "precise-shorekeeper-attr-1505004",
  chaosTheory: "precise-shorekeeper-attr-1505010",
  enlightenment: "precise-shorekeeper-attr-1505020",
  discernment: "precise-shorekeeper-attr-1505021",
  flareStarButterfly: "precise-shorekeeper-attr-1505026",
  illation: "precise-shorekeeper-attr-1505027",
  transmutation: "precise-shorekeeper-attr-1505028",
} as const;

export const SHOREKEEPER_MANUAL = {
  endLoop: "precise-shorekeeper-end-loop",
} as const;

const source: SourceMetadata = {
  kind: "multi-source-verified",
  source: "Wuthering Waves Wiki / Prydwen · Shorekeeper precise missing action",
  gameVersion: "3.5",
  verifiedAt: "2026-08-19",
  notes: "End Loop has no damage row in the generated GameDatabase projection. It is authored only as a zero-MV timeline/action event; no synthetic sourceAttributeId or damage is assigned.",
};

const unknownTiming = (note: string) => ({
  value: null,
  confidence: "unknown" as const,
  sourceNote: note,
});

const endLoop: PreciseAction = {
  id: SHOREKEEPER_MANUAL.endLoop,
  name: "End Loop",
  sourceSkillName: "End Loop",
  sourceSkillType: "Resonance Liberation",
  talent: "resonanceLiberation",
  damageType: "resonanceLiberation",
  scaling: "damage",
  scalingAttribute: "hp",
  level: 10,
  multipliers: [],
  castDurationSeconds: unknownTiming(
    "No reviewed frame-exact End Loop duration is published; the shared theoretical Liberation profile owns timing.",
  ),
  recoverySeconds: unknownTiming("No reviewed End Loop recovery timing is published."),
  hitTimingsSeconds: unknownTiming("End Loop is non-damaging in the precise personal projection."),
  notes: [
    "Creates Outer Stellarealm for 30s; allied Intro evolution to Inner/Supernal is Team Cycle-owned.",
    "No damage is emitted because GameDatabase has no End Loop damage action for Shorekeeper.",
  ],
  source,
};

const empiricalGainByAttribute: Readonly<Record<string, number>> = {
  "1505001": 1,
  "1505002": 1,
  "1505003": 2,
  "1505004": 1,
};

export function applyPreciseShorekeeperActionPatches(
  actions: readonly PreciseAction[],
): readonly PreciseAction[] {
  const patched = actions.map((action) => {
    const sourceAttributeId = action.sourceAttributeId;
    const empiricalGain = sourceAttributeId
      ? empiricalGainByAttribute[sourceAttributeId]
      : undefined;
    if (empiricalGain !== undefined) {
      return {
        ...action,
        resourceOperations: [
          ...(action.resourceOperations ?? []),
          {
            resourceId: "empirical-data",
            operation: "gain" as const,
            amount: empiricalGain,
            stage: "after-action" as const,
          },
        ],
      };
    }
    if (sourceAttributeId === "1505021") {
      return {
        ...action,
        damageType: "resonanceLiberation" as const,
        notes: [
          ...(action.notes ?? []),
          "Discernment is guaranteed to Crit and is considered Resonance Liberation DMG.",
        ],
      };
    }
    if (sourceAttributeId === "1505026") {
      return {
        ...action,
        damageType: "basicAttack" as const,
        notes: [
          ...(action.notes ?? []),
          "Game damage data classifies Flare Star Butterfly as Basic Attack DMG.",
        ],
      };
    }
    if (sourceAttributeId === "1505027") {
      return {
        ...action,
        damageType: "heavyAttack" as const,
        resourceOperations: [
          ...(action.resourceOperations ?? []),
          {
            resourceId: "empirical-data",
            operation: "consume" as const,
            amount: 5,
            stage: "before-action" as const,
          },
        ],
        notes: [
          ...(action.notes ?? []),
          "Game damage data classifies Illation as Heavy Attack DMG.",
        ],
      };
    }
    if (sourceAttributeId === "1505028") {
      return {
        ...action,
        damageType: "basicAttack" as const,
        notes: [
          ...(action.notes ?? []),
          "Game damage data classifies Transmutation as Basic Attack DMG.",
        ],
      };
    }
    return action;
  });

  if (patched.some((action) => action.id === endLoop.id)) {
    throw new Error(`Shorekeeper manual action id collides with generated action ${endLoop.id}.`);
  }
  return [...patched, endLoop];
}
