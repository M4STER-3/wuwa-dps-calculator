import { generatedVerinaGameDatabaseCombat } from "@/generated/verina-game-database-combat";
import type { CombatAction, Resonator } from "@/domain/models";
import {
  fallacyOfNoReturn,
  rejuvenatingGlow,
  variation,
  verina as completedVerina,
  verinaPreset,
  verinaSource,
} from "./verina-complete";

type GeneratedMappedAction = (typeof generatedVerinaGameDatabaseCombat.mappedActions)[number];

const generatedByActionId = new Map<string, GeneratedMappedAction>(
  generatedVerinaGameDatabaseCombat.mappedActions.map((entry) => [entry.actionId, entry]),
);

function withExactTalentLevels(action: CombatAction): CombatAction {
  if (!action.multipliers.length) return action;
  const generated = generatedByActionId.get(action.id);
  if (!generated) {
    throw new Error(`Verina action ${action.id} is missing from the validated GameDatabase projection.`);
  }
  return {
    ...action,
    multipliersByTalentLevel: generated.multipliersByTalentLevel,
  };
}

export const verinaActions: readonly CombatAction[] =
  completedVerina.combat?.actions.map(withExactTalentLevels) ?? [];

export const verina: Resonator = {
  ...completedVerina,
  combat: completedVerina.combat
    ? {
        ...completedVerina.combat,
        level10Only: false,
        actions: verinaActions,
        unknowns: completedVerina.combat.unknowns.filter(
          (unknown) => unknown !== "Talent levels 2-9.",
        ),
      }
    : undefined,
};

export {
  fallacyOfNoReturn,
  rejuvenatingGlow,
  variation,
  verinaPreset,
  verinaSource,
};
