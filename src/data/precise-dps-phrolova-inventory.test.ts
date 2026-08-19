import { describe, it } from "vitest";
import { preciseDpsFutureResonators } from "./precise-dps-future";

describe("temporary Phrolova GameDatabase inventory", () => {
  it("prints exact projected action identities", () => {
    const phrolova = preciseDpsFutureResonators.find((entry) => entry.id === "phrolova");
    if (!phrolova?.combat) throw new Error("Phrolova precise projection missing.");
    const inventory = phrolova.combat.actions.map((action) => {
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
    throw new Error(`PHROLOVA_ACTION_INVENTORY=${JSON.stringify(inventory)}`);
  });
});
