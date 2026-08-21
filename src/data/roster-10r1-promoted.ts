import type { Resonator, Weapon } from "@/domain/models";
import {
  generatedCharacterBoxRoster10R1,
  generatedCharacterBoxWeapons10R1,
} from "@/generated/character-box-roster-10r1";
import { generatedCharacterBoxRosterMedia10R1 } from "@/generated/character-box-roster-media-10r1";
import { generatedCharacterBoxCombat10R1 } from "@/generated/character-box-combat-10r1";
import { materializeProjectedCombatActions } from "./personal-dps-roster-registry";
import { roster10R1 } from "./roster-10r1";

const projectedSource = {
  kind: "verified-game-data" as const,
  source: "WUWA GameDatabase V1 · Release projection",
  notes:
    "Projection build-time whitelisted par ID Wuthering Waves. Les données lourdes et métadonnées source ne sont pas exposées au navigateur.",
};

const projectedCombatSource = {
  kind: "verified-game-data" as const,
  source: "WUWA GameDatabase V1 · universal combat projection",
  notes:
    "Multiplicateurs Lv1–10 projetés depuis les attributs de compétence exacts. Les rares corrections de scaling/type de dégâts sont déclarées dans le registre data-only et validées fail-closed.",
};

export const roster10R1PromotedResonators: readonly Resonator[] =
  generatedCharacterBoxRoster10R1.map((entry) => {
    const combat = generatedCharacterBoxCombat10R1[entry.id];
    const actions = materializeProjectedCombatActions(
      entry.id,
      combat.actions,
    );
    return {
      id: entry.id,
      name: entry.name,
      element: entry.element,
      weaponType: entry.weaponType,
      rarity: entry.rarity,
      portrait: {
        src: generatedCharacterBoxRosterMedia10R1[entry.sourceItemId],
        alt: `Portrait de ${entry.name}`,
      },
      baseStats: [combat.baseStats],
      skillNames: entry.skillNames,
      resonanceChain: entry.resonanceChain,
      combat: {
        level10Only: false,
        forms: [entry.name],
        defaultForm: entry.name,
        modes: [],
        resources: [],
        actions,
        effects: [],
        rotations: [],
        unknowns: [
          "Exact animation-frame cast durations and per-hit timestamps are not present in GameDatabase V1.",
          "Character-specific conditional mechanics require explicit structured data before they can affect the generic runtime.",
        ],
        source: projectedCombatSource,
      },
      source: {
        ...projectedSource,
        notes: `${projectedSource.notes} Wuwa ID ${entry.sourceItemId}.`,
      },
    } satisfies Resonator;
  });

export const roster10R1PromotedWeapons: readonly Weapon[] =
  generatedCharacterBoxWeapons10R1.map((entry) => {
    const owner = roster10R1.find(
      (candidate) => candidate.signatureWeapon.id === entry.id,
    );
    if (!owner) {
      throw new Error(`Missing reviewed owner for signature weapon ${entry.id}`);
    }
    const ownerId = owner.id as keyof typeof generatedCharacterBoxCombat10R1;
    const combat = generatedCharacterBoxCombat10R1[ownerId];
    return {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      rarity: entry.rarity,
      level90Stats: {
        baseAttack: combat.weaponLevel90.baseAttack,
        displayBaseAttack: Math.round(combat.weaponLevel90.baseAttack),
      },
      source: {
        ...projectedSource,
        notes: `${projectedSource.notes} Wuwa ID ${entry.sourceItemId}.`,
      },
    } satisfies Weapon;
  });
