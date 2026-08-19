import { describe, it } from "vitest";
import { preciseDpsFutureResonators } from "./precise-dps-future";

describe("temporary Galbrena GameDatabase inventory", () => {
  it("prints exact projected action identities", () => {
    const galbrena = preciseDpsFutureResonators.find((entry) => entry.id === "galbrena");
    if (!galbrena?.combat) throw new Error("Galbrena precise projection missing.");
    const inventory = galbrena.combat.actions.map((action) => {
      const precise = action as typeof action & {
        sourceAttributeId?: string;
        sourceSkillId?: string;
        sourceSkillName?: string;
        sourceSkillType?: string;
      };
      return {
        id: action.id,
        sourceAttributeId: precise.sourceAttributeId,
        sourceSkillId: precise.sourceSkillId,
        sourceSkillName: precise.sourceSkillName,
        sourceSkillType: precise.sourceSkillType,
        talent: action.talent,
        damageType: action.damageType,
        name: action.name,
        multipliers: action.multipliers,
      };
    });
    throw new Error(`GALBRENA_ACTION_INVENTORY=${JSON.stringify(inventory)}`);
  });
});
