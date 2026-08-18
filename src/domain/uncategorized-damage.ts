import {
  calculateActionDamage,
  type DamageModifiers,
  type StandardDamageRequest,
  type StandardDamageResult,
  type UnsupportedDamageResult,
} from "./damage-engine";

/**
 * Standard elemental damage that has no Basic/Heavy/Skill/Liberation/Intro/Echo
 * panel category. This is deliberately generic: Outro damage and future mechanics
 * can opt into it without teaching the engine any Resonator names.
 */
export type UncategorizedDamageResultV1 = Omit<
  StandardDamageResult,
  "effectiveDamageType" | "damageTypeBonusPercent" | "additionalDamageTypeBonusPercent"
> & {
  effectiveDamageType: "uncategorized";
  damageTypeBonusPercent: 0;
  additionalDamageTypeBonusPercent: 0;
};

export type UncategorizedDamageRequestV1 = Omit<
  StandardDamageRequest,
  "effectiveDamageType"
>;

export function calculateUncategorizedDamageV1(
  request: UncategorizedDamageRequestV1,
): UncategorizedDamageResultV1 | UnsupportedDamageResult {
  const incoming = request.modifiers ?? {};
  const modifiers: DamageModifiers = {
    ...incoming,
    // The shared standard formula needs one internal category to execute. Cancel
    // that category's panel bonus exactly, and do not apply a type-specific bonus
    // to damage that has no panel category.
    additionalDamageTypeBonusPercent:
      -request.finalStats.damageTypeBonus.introSkill,
  };

  const result = calculateActionDamage({
    ...request,
    effectiveDamageType: "introSkill",
    modifiers,
  });
  if (result.status === "unsupported") return result;

  return {
    ...result,
    effectiveDamageType: "uncategorized",
    damageTypeBonusPercent: 0,
    additionalDamageTypeBonusPercent: 0,
  };
}
