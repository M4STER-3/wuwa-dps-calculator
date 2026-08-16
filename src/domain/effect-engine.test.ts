import { describe, expect, it } from "vitest";
import { aemeath, everbrightPolestar, sigillum, trailblazingStar } from "@/data/aemeath";
import { resolveActiveEffects, type EffectResolutionContext } from "./effect-engine";
import type { ActiveEffectInstance, EffectDefinition, EffectModifier } from "./effect-models";

const context: EffectResolutionContext = {
  actorId: "actor", targetId: "enemy-1", teamMemberIds: ["actor", "ally"],
  element: "fusion", damageType: "resonanceLiberation", resonanceMode: "fusion-burst",
  actionId: "finale", actionCategories: ["ultimate"],
};

function definition(modifier: EffectModifier, selectors: EffectDefinition["rules"][number]["selectors"] = [], accounting: EffectDefinition["rules"][number]["accounting"] = "runtime"): EffectDefinition {
  return { id: "fixture", label: "Generic fixture", source: { id: "fixture-source", type: "system", label: "Fixture" }, target: "self",
    rules: [{ id: "rule", label: "Generic rule", accounting, selectors, modifiers: [modifier] }] };
}
function active(value: EffectDefinition, stacks?: number): ActiveEffectInstance { return { id: `active-${value.id}`, definition: value, ownerId: "actor", stacks }; }
function real(effect: { structuredEffect?: EffectDefinition }): ActiveEffectInstance { return active(effect.structuredEffect!); }

describe("Universal Effect & Modifier Engine V0.1 — generic fixtures", () => {
  it("applies +20% Fusion DMG only to Fusion", () => {
    const item = active(definition({ kind: "elemental-damage-bonus", value: 20, stacking: "additive" }, [{ kind: "element", anyOf: ["fusion"] }]));
    expect(resolveActiveEffects([item], context).damageModifiers.additionalElementalDamageBonusPercent).toBe(20);
    const miss = resolveActiveEffects([item], { ...context, element: "spectro" });
    expect(miss.damageModifiers).toEqual({});
    expect(miss.audit[0]).toMatchObject({ status: "ignored", reason: "element-mismatch" });
  });

  it("applies +25% Liberation DMG only to Liberation", () => {
    const item = active(definition({ kind: "damage-type-bonus", value: 25, stacking: "additive" }, [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }]));
    expect(resolveActiveEffects([item], context).damageModifiers.additionalDamageTypeBonusPercent).toBe(25);
    expect(resolveActiveEffects([item], { ...context, damageType: "basicAttack" }).audit[0].reason).toBe("damage-type-mismatch");
  });

  it("keeps +200% Heavy amplification outside the Damage Bonus group", () => {
    const item = active(definition({ kind: "damage-amplification", value: 200, stacking: "additive" }, [{ kind: "damage-type", anyOf: ["heavyAttack"] }]));
    const result = resolveActiveEffects([item], { ...context, damageType: "heavyAttack" });
    expect(result.damageModifiers.damageAmplificationPercent).toBe(200);
    expect(result.damageModifiers.additionalDamageTypeBonusPercent).toBeUndefined();
  });

  it("keeps DEF Ignore distinct from DEF Reduction", () => {
    const result = resolveActiveEffects([active(definition({ kind: "defense-ignore", value: 0.32, stacking: "additive" }))], context);
    expect(result.damageModifiers).toMatchObject({ defenseIgnore: 0.32 });
    expect(result.damageModifiers.defenseReduction).toBeUndefined();
  });

  it("applies Fusion RES Ignore only to Fusion", () => {
    const item = active(definition({ kind: "resistance-ignore", value: 0.1, stacking: "additive" }, [{ kind: "element", anyOf: ["fusion"] }]));
    expect(resolveActiveEffects([item], context).damageModifiers.resistanceIgnore).toBe(0.1);
    expect(resolveActiveEffects([item], { ...context, element: "spectro" }).damageModifiers.resistanceIgnore).toBeUndefined();
  });

  it("resolves Crit Rate as a Crit bonus", () => {
    expect(resolveActiveEffects([active(definition({ kind: "crit-rate-bonus", value: 20, stacking: "additive" }))], context).damageModifiers.critRateBonusPercent).toBe(20);
  });

  it("linearly scales 4% through 30 resolved stacks", () => {
    const item = active(definition({ kind: "damage-amplification", valuePerStack: 4, maxStacks: 30, stacking: "additive" }), 30);
    expect(resolveActiveEffects([item], context).damageModifiers.damageAmplificationPercent).toBe(120);
  });

  it("does not emit rules already represented by finalStats", () => {
    const item = active(definition({ kind: "crit-rate-bonus", value: 20, stacking: "additive" }, [], "already-in-final-stats"));
    const result = resolveActiveEffects([item], context);
    expect(result.damageModifiers).toEqual({});
    expect(result.audit[0]).toMatchObject({ status: "ignored", reason: "already-in-final-stats" });
  });

  it("supports additive, highest and explicit override policies deterministically", () => {
    const values = [
      active(definition({ kind: "crit-damage-bonus", value: 10, stacking: "additive" })),
      active({ ...definition({ kind: "crit-damage-bonus", value: 20, stacking: "highest" }), id: "high" }),
    ];
    expect(resolveActiveEffects(values, context).damageModifiers.critDamageBonusPercent).toBe(30);
    const override = active({ ...definition({ kind: "crit-damage-bonus", value: 99, stacking: "override" }), id: "override" });
    expect(resolveActiveEffects([...values, override], context).damageModifiers.critDamageBonusPercent).toBe(99);
  });

  it("transports Tune boost and fixed Crit override without inventing formulas", () => {
    const tune = active(definition({ kind: "temporary-tune-break-boost", value: 15, stacking: "additive" }));
    const crit: EffectDefinition = { ...definition({ kind: "crit-rate-bonus", value: 0, stacking: "additive" }), id: "crit", rules: [{ id: "crit", label: "Fixed Crit", accounting: "runtime", modifiers: [{ kind: "fixed-crit-override", stacking: "override", critRatePercent: 80, critDamagePercent: 275 }] }] };
    const result = resolveActiveEffects([tune, active(crit)], context);
    expect(result.tuneDamageModifiers.temporaryTuneBreakBoostPercent).toBe(15);
    expect(result.overrides.fixedCrit).toEqual({ critRatePercent: 80, critDamagePercent: 275 });
    expect(result.damageModifiers.critRateBonusPercent).toBeUndefined();
  });

  it("reports invalid stacks, missing context and unknown rules instead of guessing", () => {
    const stacked = active(definition({ kind: "damage-amplification", valuePerStack: 4, stacking: "additive" }), -1);
    const missing = active(definition({ kind: "elemental-damage-bonus", value: 1, stacking: "additive" }, [{ kind: "element", anyOf: ["fusion"] }]));
    const unknown = active(definition({ kind: "future-kind" as EffectModifier["kind"], value: 1, stacking: "additive" }));
    expect(resolveActiveEffects([stacked], context).diagnostics[0].code).toBe("invalid-stacks");
    expect(resolveActiveEffects([missing], { ...context, element: undefined }).diagnostics[0].code).toBe("missing-context");
    expect(resolveActiveEffects([unknown], context).diagnostics[0].code).toBe("unsupported-modifier-kind");
  });
});

describe("Universal engine — current Aemeath data validation", () => {
  it("resolves Everbright R1 rules for Finale while retaining an auditable source", () => {
    const base = everbrightPolestar.effects![0]; const conditional = everbrightPolestar.effects![1];
    const result = resolveActiveEffects([real(base), real(conditional)], context);
    expect(result.damageModifiers).toMatchObject({ allDamageBonusPercent: 12, defenseIgnore: 0.32, resistanceIgnore: 0.1 });
    expect(result.audit).toHaveLength(3);
    expect(result.audit.every((entry) => entry.sourceId === "everbright-polestar" && entry.status === "matched")).toBe(true);
  });

  it("resolves active Trailblazing 5pc Crit and Fusion bonuses", () => {
    const result = resolveActiveEffects([real(trailblazingStar.effects![1])], context);
    expect(result.damageModifiers).toMatchObject({ critRateBonusPercent: 20, additionalElementalDamageBonusPercent: 20 });
  });

  it("applies Sigillum to Finale but not Basic Attack", () => {
    const instance = real(sigillum.effects![0]);
    expect(resolveActiveEffects([instance], context).damageModifiers.additionalDamageTypeBonusPercent).toBe(25);
    expect(resolveActiveEffects([instance], { ...context, damageType: "basicAttack" }).audit[0]).toMatchObject({ status: "ignored", reason: "damage-type-mismatch" });
  });

  it("resolves Before All Sounds only for an already-active Heavy instance", () => {
    const legacy = aemeath.combat!.effects.find((effect) => effect.id === "before-all-sounds")!;
    const instance = real(legacy);
    expect(resolveActiveEffects([instance], { ...context, damageType: "heavyAttack" }).damageModifiers.damageAmplificationPercent).toBe(200);
    expect(resolveActiveEffects([instance], context).damageModifiers.damageAmplificationPercent).toBeUndefined();
  });
});
