import { describe, expect, it } from "vitest";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";

type ProjectedAction = {
  id: string;
  name: string;
  talent: string;
  damageType?: string;
  sourceAttributeId?: string;
  sourceSkillName?: string;
  multipliers: readonly { percent: number; hits: number }[];
};

describe("Iuno GameDatabase inventory probe", () => {
  it("prints stable projected identities without changing runtime semantics", () => {
    const resonator = findPreciseDpsResonator("iuno");
    const weapon = findPreciseDpsWeapon("iuno");
    expect(resonator).toBeDefined();
    expect(weapon).toBeDefined();
    const actions = (resonator!.combat?.actions ?? []) as readonly ProjectedAction[];
    expect(actions.length).toBeGreaterThan(0);
    console.log("IUNO_ACTION_INVENTORY", JSON.stringify(actions.map((action) => ({
      id: action.id,
      sourceAttributeId: action.sourceAttributeId,
      name: action.name,
      talent: action.talent,
      damageType: action.damageType,
      sourceSkillName: action.sourceSkillName,
      multipliers: action.multipliers,
    }))));
    console.log("IUNO_WEAPON_INVENTORY", JSON.stringify({
      id: weapon!.id,
      name: weapon!.name,
      level90Stats: weapon!.level90Stats,
      passiveDescription: weapon!.passiveDescription,
      effects: weapon!.effects,
    }));
  });
});
