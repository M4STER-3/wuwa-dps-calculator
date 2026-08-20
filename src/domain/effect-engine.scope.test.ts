import { describe, expect, it } from "vitest";
import { resolveActiveEffects, type EffectResolutionContext } from "./effect-engine";
import type { ActiveEffectInstance, EffectDefinition, EffectTargetScope } from "./effect-models";

const context: EffectResolutionContext = {
  actorId: "owner",
  targetId: "enemy",
  teamMemberIds: ["owner", "ally"],
};

function instance(
  target: EffectTargetScope,
  affectedEntityIds?: readonly string[],
): ActiveEffectInstance {
  const definition: EffectDefinition = {
    id: `scope-${target}`,
    label: `Scope ${target}`,
    source: { id: "scope-source", type: "system", label: "Scope fixture" },
    target,
    rules: [{
      id: "bonus",
      label: "Fixture bonus",
      accounting: "runtime",
      modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 20 }],
    }],
  };
  return {
    id: `active-${target}`,
    definition,
    ownerId: "owner",
    affectedEntityIds,
  };
}

describe("Effect recipient scopes — personal/team contract", () => {
  it("keeps self and true team buffs on the owner when the kit allows it", () => {
    expect(resolveActiveEffects([instance("self")], context).damageModifiers.allDamageBonusPercent).toBe(20);
    expect(resolveActiveEffects([instance("team")], context).damageModifiers.allDamageBonusPercent).toBe(20);
  });

  it("never gives other-team-members buffs back to their owner", () => {
    const effect = instance("other-team-members");
    expect(resolveActiveEffects([effect], context).damageModifiers).toEqual({});
    expect(resolveActiveEffects([effect], { ...context, actorId: "ally" }).damageModifiers.allDamageBonusPercent).toBe(20);
  });

  it("fails closed for incoming-resonator and active-resonator without an explicit Team recipient", () => {
    for (const scope of ["incoming-resonator", "active-resonator"] as const) {
      const result = resolveActiveEffects([instance(scope)], context);
      expect(result.damageModifiers).toEqual({});
      expect(result.audit[0]).toMatchObject({
        status: "ignored",
        reason: `scope-${scope}-recipient-unresolved`,
      });
    }
  });

  it("lets Team DPS resolve an incoming recipient explicitly without changing ownership", () => {
    const effect = instance("incoming-resonator", ["ally"]);
    expect(resolveActiveEffects([effect], context).damageModifiers).toEqual({});
    expect(resolveActiveEffects([effect], { ...context, actorId: "ally" }).damageModifiers.allDamageBonusPercent).toBe(20);
  });
});
