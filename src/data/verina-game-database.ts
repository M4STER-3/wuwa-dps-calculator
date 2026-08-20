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

const generatedVerinaActions = generatedVerinaGameDatabaseCombat.actions;

const sameGroup = (
  left: CombatAction["multipliers"][number],
  right: CombatAction["multipliers"][number],
) => left.percent === right.percent && left.hits === right.hits;

const sameGroups = (
  left: CombatAction["multipliers"],
  right: CombatAction["multipliers"],
) =>
  left.length === right.length &&
  left.every((group, index) => sameGroup(group, right[index]!));

function singleGeneratedMatch(action: CombatAction) {
  const matches = generatedVerinaActions.filter(
    (candidate) =>
      candidate.talent === action.talent &&
      sameGroups(candidate.multipliers, action.multipliers),
  );
  if (matches.length !== 1) return null;
  return matches[0]!;
}

function groupedGeneratedMatches(action: CombatAction) {
  const matches = action.multipliers.map((group) => {
    const candidates = generatedVerinaActions.filter(
      (candidate) =>
        candidate.talent === action.talent &&
        candidate.multipliers.length === 1 &&
        sameGroup(candidate.multipliers[0]!, group),
    );
    if (candidates.length !== 1) {
      throw new Error(
        `Verina action ${action.id} group ${group.percent}%*${group.hits} resolves to ${candidates.length} GameDatabase rows.`,
      );
    }
    return candidates[0]!;
  });
  if (new Set(matches.map((candidate) => candidate.id)).size !== matches.length) {
    throw new Error(`Verina action ${action.id} reuses a GameDatabase talent row.`);
  }
  return matches;
}

function withExactTalentLevels(action: CombatAction): CombatAction {
  if (!action.multipliers.length) return action;

  const single = singleGeneratedMatch(action);
  if (single) {
    return {
      ...action,
      multipliersByTalentLevel: single.multipliersByTalentLevel,
    };
  }

  const grouped = groupedGeneratedMatches(action);
  const multipliersByTalentLevel = Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => {
      const level = String(index + 1);
      const groups = grouped.flatMap((candidate) =>
        candidate.multipliersByTalentLevel[
          level as keyof typeof candidate.multipliersByTalentLevel
        ] ?? [],
      );
      if (groups.length !== action.multipliers.length) {
        throw new Error(
          `Verina action ${action.id} produced ${groups.length} GameDatabase groups at Lv${level}.`,
        );
      }
      return [level, groups];
    }),
  );

  return {
    ...action,
    multipliersByTalentLevel,
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
