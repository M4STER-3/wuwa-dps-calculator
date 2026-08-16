import type { CombatAction, TalentLevel } from "./models";

export type TalentActionResolution =
  | { status: "supported"; action: CombatAction }
  | { status: "unsupported"; action: CombatAction; reason: "missing-exact-talent-data"; message: string };

/** Resolves only exact, level-owned data. It deliberately has no interpolation path. */
export function resolveActionTalentLevel(action: CombatAction, level: number): TalentActionResolution {
  if (!Number.isInteger(level) || level < 1 || level > 10) {
    return { status: "unsupported", action, reason: "missing-exact-talent-data", message: `Talent level ${level} is outside 1-10.` };
  }
  if (level === action.level) return { status: "supported", action };
  const exact = action.multipliersByTalentLevel?.[level as TalentLevel];
  if (!exact) return { status: "unsupported", action, reason: "missing-exact-talent-data", message: `No exact Lv${level} data for ${action.id}.` };
  return { status: "supported", action: { ...action, level: level as TalentLevel, multipliers: exact } };
}
