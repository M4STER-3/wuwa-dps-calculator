import type { Resonator } from "@/domain/models";

/**
 * Some Outros deal ordinary Attribute DMG but are not Basic/Heavy/Skill/Lib/Echo
 * damage. Their exact formula is still standard damage; only the type-specific
 * bonus channel is absent. Classify those actions universally as neutral Outro
 * damage instead of assigning a false game category.
 */
export function applyPreciseNeutralOutroDamageTypes(resonator: Resonator): Resonator {
  if (!resonator.combat) return resonator;
  let changed = false;
  const actions = resonator.combat.actions.map((action) => {
    if (
      action.talent !== "outroSkill" ||
      action.damageType !== undefined ||
      action.scaling !== "damage" ||
      action.multipliers.length === 0
    ) {
      return action;
    }
    changed = true;
    return {
      ...action,
      damageType: "outroSkill" as const,
      notes: [
        ...(action.notes ?? []),
        "Neutral Outro damage: standard Attribute DMG formula with no dedicated damage-type bonus channel.",
      ],
    };
  });
  return changed
    ? { ...resonator, combat: { ...resonator.combat, actions } }
    : resonator;
}
