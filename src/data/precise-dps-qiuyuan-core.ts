import type { CombatAction, SourceMetadata } from "@/domain/models";

type PreciseAction = CombatAction & { readonly sourceAttributeId?: string };

export const QIUYUAN_MANUAL = {
  intro: "precise-qiuyuan-intro-attack-the-must-defend",
  strawCape: "precise-qiuyuan-s3-straw-cape-in-drizzly-rain",
  outro: "precise-qiuyuan-outro-strike-before-ready",
  s3Outro: "precise-qiuyuan-s3-outro-sheath-fallen-new-shoots-revealed",
  s6Exit: "precise-qiuyuan-s6-inksplash-exit",
} as const;

export const QIUYUAN_NATIVE = {
  liberation: "precise-qiuyuan-attr-1308014",
  inkwash3: "precise-qiuyuan-attr-1308023",
  inkwash4: "precise-qiuyuan-attr-1308024",
  teach: "precise-qiuyuan-attr-1308025",
  save: "precise-qiuyuan-attr-1308026",
  sacrifice: "precise-qiuyuan-attr-1308027",
} as const;

const source: SourceMetadata = {
  kind: "multi-source-verified",
  source: "Wuthering Waves Wiki / Prydwen · Qiuyuan precise missing actions",
  gameVersion: "3.5",
  verifiedAt: "2026-08-19",
  notes: "Only actions absent from the generated GameDatabase projection are authored here. No synthetic sourceAttributeId is assigned.",
};

const unknownTiming = (note: string) => ({
  value: null,
  confidence: "unknown" as const,
  sourceNote: note,
});

const manualAction = (
  id: string,
  name: string,
  talent: CombatAction["talent"],
  damageType: NonNullable<CombatAction["damageType"]>,
  multipliers: CombatAction["multipliers"],
  notes: readonly string[],
): CombatAction => ({
  id,
  name,
  talent,
  damageType,
  scaling: "damage",
  scalingAttribute: "attack",
  level: 10,
  multipliers,
  castDurationSeconds: unknownTiming("No reviewed frame-exact duration is published; the shared theoretical rotation profile owns timing."),
  recoverySeconds: unknownTiming("No reviewed recovery timing is published."),
  hitTimingsSeconds: unknownTiming("No reviewed frame-exact hit timestamps are published."),
  notes,
  source,
});

const manualActions: readonly CombatAction[] = [
  {
    ...manualAction(
      QIUYUAN_MANUAL.intro,
      "Attack the Must-Defend",
      "introSkill",
      "heavyAttack",
      [
        { percent: 9.55, hits: 5 },
        { percent: 47.72, hits: 1 },
        { percent: 143.15, hits: 1 },
      ],
      [
        "Verified Lv10 Intro scaling: 9.55%×5 + 47.72% + 143.15% ATK.",
        "Intro Skill DMG is considered Heavy Attack DMG.",
        "Grants 400 Swordster's Soliloquy after the action.",
      ],
    ),
    resourceOperations: [
      { resourceId: "swordsters-soliloquy", operation: "gain", amount: 400, stage: "after-action" },
    ],
  },
  {
    ...manualAction(
      QIUYUAN_MANUAL.strawCape,
      "Straw Cape in Drizzly Rain",
      "resonanceSkill",
      "echoSkill",
      [{ percent: 500, hits: 1 }],
      [
        "S3+ replacement Resonance Skill: 500% ATK as Echo Skill DMG.",
        "Requires full Concerto outside Inksplash; scenario eligibility owns that external precondition.",
        "Consumes 60 Concerto and restores 400 Swordster's Soliloquy; only the character-resource gain is executed here.",
      ],
    ),
    resourceOperations: [
      { resourceId: "swordsters-soliloquy", operation: "gain", amount: 400, stage: "after-action" },
    ],
  },
  manualAction(
    QIUYUAN_MANUAL.outro,
    "Strike Before Ready",
    "outroSkill",
    "echoSkill",
    [{ percent: 100, hits: 1 }],
    [
      "Deals 100% ATK as Echo Skill DMG.",
      "Incoming Resonator Echo Skill amplification is Team Cycle-owned.",
    ],
  ),
  manualAction(
    QIUYUAN_MANUAL.s3Outro,
    "Sheath Fallen, New Shoots Revealed",
    "outroSkill",
    "echoSkill",
    [{ percent: 500, hits: 1 }],
    ["S3 replacement Outro: 500% ATK as Echo Skill DMG."],
  ),
  manualAction(
    QIUYUAN_MANUAL.s6Exit,
    "Inksplash of Mind · S6 Exit",
    "forteCircuit",
    "echoSkill",
    [{ percent: 600, hits: 1 }],
    ["S6: exiting Inksplash of Mind while active deals 600% ATK as Echo Skill DMG."],
  ),
];

export function applyPreciseQiuyuanActionPatches(
  actions: readonly PreciseAction[],
): readonly PreciseAction[] {
  const patched = actions.map((action) => {
    switch (action.sourceAttributeId) {
      case "1308014":
        return {
          ...action,
          damageType: "echoSkill" as const,
          notes: [...(action.notes ?? []), "Sundering Strike is considered Echo Skill DMG."],
        };
      case "1308023":
      case "1308024":
        return {
          ...action,
          resourceOperations: [
            ...(action.resourceOperations ?? []),
            { resourceId: "swordsters-soliloquy", operation: "gain" as const, amount: 100, stage: "after-action" as const },
          ],
        };
      case "1308025":
      case "1308026":
      case "1308027":
        return {
          ...action,
          damageType: "heavyAttack" as const,
          notes: [
            ...(action.notes ?? []),
            "Thus Spoke the Blade Forte Heavy is considered performing an Echo Skill while its damage remains Heavy Attack DMG.",
          ],
        };
      default:
        return action;
    }
  });

  const ids = new Set(patched.map((action) => action.id));
  for (const action of manualActions) {
    if (ids.has(action.id)) {
      throw new Error(`Qiuyuan precise manual action id collides with generated action ${action.id}.`);
    }
  }
  return [...patched, ...manualActions];
}
