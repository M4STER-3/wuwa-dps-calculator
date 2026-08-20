import { generatedVerinaGameDatabaseCombat } from "@/generated/verina-game-database-combat";
import type { CombatAction, MotionValueGroup, Resonator } from "@/domain/models";
import {
  fallacyOfNoReturn,
  rejuvenatingGlow,
  variation,
  verina as completedVerina,
  verinaPreset,
  verinaSource,
} from "./verina-complete";

type GeneratedVerinaAction = {
  id: string;
  sourceAttributeId: string;
  talent: CombatAction["talent"];
  multipliers: readonly MotionValueGroup[];
  multipliersByTalentLevel: NonNullable<CombatAction["multipliersByTalentLevel"]>;
};

const generatedVerinaActions: readonly GeneratedVerinaAction[] =
  generatedVerinaGameDatabaseCombat.actions;

const sourceAttributeIdsByActionId: Readonly<Record<string, readonly string[]>> = {
  "verina-basic-1": ["1700001"],
  "verina-basic-2": ["1700002"],
  "verina-basic-3": ["1700003"],
  "verina-basic-4": ["1700004"],
  "verina-basic-5": ["1700005"],
  "verina-heavy": ["1700007"],
  "verina-midair-1": ["1700009"],
  "verina-midair-2": ["1700010"],
  "verina-midair-3": ["1700011"],
  "verina-midair-heavy": ["1700013"],
  "verina-dodge": ["1700015"],
  "verina-botany-experiment": ["1700016"],
  "verina-starflower-midair": ["1700028", "1700029", "1700030"],
  "verina-starflower-heavy": ["1700035"],
  "verina-arboreal-flourish": ["1700018"],
  "verina-intro": ["1700025"],
  "verina-coordinated-attack": ["1700020"],
};

const sameGroup = (
  left: CombatAction["multipliers"][number],
  right: CombatAction["multipliers"][number],
) => left.percent === right.percent && left.hits === right.hits;

const sameGroups = (
  left: readonly MotionValueGroup[],
  right: readonly MotionValueGroup[],
) =>
  left.length === right.length &&
  left.every((group, index) => sameGroup(group, right[index]!));

function generatedRowsFor(action: CombatAction): readonly GeneratedVerinaAction[] {
  const sourceAttributeIds = sourceAttributeIdsByActionId[action.id];
  if (!sourceAttributeIds) {
    throw new Error(`Verina action ${action.id} is missing a reviewed GameDatabase sourceAttributeId mapping.`);
  }
  const rows = sourceAttributeIds.map((sourceAttributeId) => {
    const matches = generatedVerinaActions.filter(
      (candidate) => candidate.sourceAttributeId === sourceAttributeId,
    );
    if (matches.length !== 1) {
      throw new Error(
        `Verina action ${action.id} sourceAttributeId ${sourceAttributeId} resolves to ${matches.length} GameDatabase rows.`,
      );
    }
    const row = matches[0]!;
    if (row.talent !== action.talent) {
      throw new Error(
        `Verina action ${action.id} expected talent ${action.talent} but GameDatabase ${sourceAttributeId} is ${row.talent}.`,
      );
    }
    return row;
  });
  if (new Set(rows.map((row) => row.sourceAttributeId)).size !== rows.length) {
    throw new Error(`Verina action ${action.id} reuses a GameDatabase sourceAttributeId.`);
  }
  return rows;
}

function groupsAtLevel(
  rows: readonly GeneratedVerinaAction[],
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
) {
  return rows.flatMap((row) => row.multipliersByTalentLevel[level] ?? []);
}

function withExactTalentLevels(action: CombatAction): CombatAction {
  if (!action.multipliers.length) return action;

  const rows = generatedRowsFor(action);
  const level10 = groupsAtLevel(rows, 10);
  if (!sameGroups(level10, action.multipliers)) {
    throw new Error(
      `Verina action ${action.id} authored Lv10 multipliers do not match its reviewed GameDatabase source rows.`,
    );
  }

  const multipliersByTalentLevel: NonNullable<CombatAction["multipliersByTalentLevel"]> =
    Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => {
        const level = (index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
        const groups = groupsAtLevel(rows, level);
        if (groups.length !== action.multipliers.length) {
          throw new Error(
            `Verina action ${action.id} produced ${groups.length} GameDatabase groups at Lv${level}; expected ${action.multipliers.length}.`,
          );
        }
        return [level, groups] as const;
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
