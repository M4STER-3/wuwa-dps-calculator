import { generatedReviewedCharacterGameDatabaseCombat } from "@/generated/reviewed-character-game-database-combat";
import { applyReviewedGameDatabaseTalentLevels } from "./reviewed-game-database-combat";
import {
  fallacyOfNoReturn,
  rejuvenatingGlow,
  variation,
  verina as completedVerina,
  verinaPreset,
  verinaSource,
} from "./verina-complete";

export const verina = applyReviewedGameDatabaseTalentLevels(
  completedVerina,
  generatedReviewedCharacterGameDatabaseCombat.verina,
);

export const verinaActions = verina.combat?.actions ?? [];

export {
  fallacyOfNoReturn,
  rejuvenatingGlow,
  variation,
  verinaPreset,
  verinaSource,
};
