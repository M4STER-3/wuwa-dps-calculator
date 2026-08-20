import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  preciseDpsLoadoutResonators,
  preciseDpsLoadoutWeapons,
} from "./precise-dps-loadouts";
import rawRegistry from "./precise-dps-future-registry.json";

type Registry = {
  version: number;
  entries: readonly { id: string; name: string; signatureWeaponName: string }[];
};

type ExternalIds = { wuwa?: string };
type DatabaseSkill = {
  id: string;
  name: string;
  description?: string;
  sourceParameters?: unknown;
};
type Database = {
  characters: readonly {
    name: string;
    externalIds?: ExternalIds;
    skills?: readonly DatabaseSkill[];
  }[];
  weapons: readonly {
    name: string;
    externalIds?: ExternalIds;
    baseStats?: {
      secondaryStat?: {
        stat: string;
        unit: string;
        progression: { points: readonly { level: number; value: number; ascended?: boolean }[] };
      };
    };
  }[];
};
type Manifest = {
  entities: {
    characters: Record<string, { assets: Record<string, { path: string }> }>;
    weapons: Record<string, { assets: Record<string, { path: string }> }>;
  };
};

function permanentRules(
  effects: readonly {
    id: string;
    structuredEffect?: {
      id: string;
      activationPolicy?: string;
      rules: readonly {
        id: string;
        accounting: string;
        requiredSequence?: number;
        predicates?: readonly unknown[];
        selectors?: readonly unknown[];
        modifiers: readonly unknown[];
      }[];
    };
  }[] | undefined,
) {
  return (effects ?? []).flatMap((effect) =>
    (effect.structuredEffect?.rules ?? [])
      .filter((rule) => rule.accounting === "already-in-final-stats")
      .map((rule) => ({
        effectId: effect.structuredEffect!.id,
        combatEffectId: effect.id,
        activationPolicy: effect.structuredEffect!.activationPolicy,
        ruleId: rule.id,
        requiredSequence: rule.requiredSequence,
        predicates: rule.predicates ?? [],
        selectors: rule.selectors ?? [],
        modifiers: rule.modifiers,
      })),
  );
}

function permanentStatCandidates(skills: readonly DatabaseSkill[] | undefined) {
  const marker = /(crit|atk|attack|hp|def|energy|regen|damage|dmg|bonus)/i;
  return (skills ?? [])
    .filter((skill) => marker.test(`${skill.name} ${skill.description ?? ""}`))
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      sourceParameters: skill.sourceParameters,
    }));
}

describe("precise Character Box projection probe", () => {
  it("prints exact Lv90 signature stats, local UI bindings and permanent panel inputs", () => {
    const registry = rawRegistry as Registry;
    const database = JSON.parse(
      readFileSync(resolve(process.cwd(), "public/data/wuwa/game-database-v1.json"), "utf8"),
    ) as Database;
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "public/assets/wuwa/manifest.json"), "utf8"),
    ) as Manifest;

    const rows = registry.entries.map((entry) => {
      const character = database.characters.find((candidate) => candidate.name === entry.name);
      const weapon = database.weapons.find((candidate) => candidate.name === entry.signatureWeaponName);
      const projectedResonator = preciseDpsLoadoutResonators.find((candidate) => candidate.id === entry.id);
      const projectedWeapon = preciseDpsLoadoutWeapons.find(
        (candidate) => candidate.resonatorId === entry.id,
      )?.weapon;
      expect(character, `character ${entry.name}`).toBeDefined();
      expect(weapon, `weapon ${entry.signatureWeaponName}`).toBeDefined();
      expect(projectedResonator, `projected resonator ${entry.id}`).toBeDefined();
      expect(projectedWeapon, `projected weapon ${entry.id}`).toBeDefined();
      expect(projectedWeapon?.name).toBe(entry.signatureWeaponName);
      const secondary = weapon?.baseStats?.secondaryStat;
      expect(secondary, `secondary ${entry.signatureWeaponName}`).toBeDefined();
      const level90 = secondary?.progression.points.filter((point) => point.level === 90) ?? [];
      const selected = level90.find((point) => point.ascended === true) ?? level90.at(-1)!;
      const resonatorAssetId = character?.externalIds?.wuwa;
      const weaponAssetId = weapon?.externalIds?.wuwa;
      expect(resonatorAssetId).toMatch(/^\d+$/);
      expect(weaponAssetId).toMatch(/^\d+$/);
      const portraitPath = manifest.entities.characters[resonatorAssetId!]?.assets["list-roleheadicon"]?.path;
      const weaponPath = manifest.entities.weapons[weaponAssetId!]?.assets["list-icon"]?.path;
      expect(portraitPath).toMatch(/^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/);
      expect(weaponPath).toMatch(/^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/);
      return {
        resonatorId: entry.id,
        resonatorAssetId,
        portraitPath,
        weaponId: projectedWeapon!.id,
        weaponName: entry.signatureWeaponName,
        weaponAssetId,
        weaponPath,
        secondaryStat: secondary!.stat,
        secondaryValue: selected.value,
        characterPermanentRules: permanentRules(projectedResonator?.combat?.effects),
        weaponPermanentRules: permanentRules(projectedWeapon?.effects),
        permanentStatCandidates: permanentStatCandidates(character?.skills),
      };
    });

    expect(rows).toHaveLength(10);
    console.log("[PRECISE_CHARACTER_BOX_PROBE]", JSON.stringify(rows));
  });
});
