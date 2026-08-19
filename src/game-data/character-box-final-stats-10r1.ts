import type { FinalStats, UserBuild } from "@/domain/models";
import {
  generatedCharacterBoxCharacterBases10R1,
  generatedCharacterBoxWeaponBases10R1,
} from "@/generated/character-box-roster-baselines-10r1";
import { generatedEchoCatalogV1 } from "@/generated/echo-catalog-v1";
import { generatedCommunityEchoPresets10R1 } from "@/generated/community-echo-presets-10r1";
import { personalDpsRuntimeIdentities10R1 } from "@/data/personal-dps-runtime-identities-10r1";
import { resolveEchoLoadoutV1, type EchoLoadoutCatalogV1 } from "./echo-loadout";

interface CharacterBaseV1 {
  hp: number;
  attack: number;
  defense: number;
  level: number;
  weaponType: string;
}
interface WeaponBaseV1 {
  attack: number;
  level: number;
  type: string;
  secondaryStat?: { stat: string; value: number };
}

const characterBases = generatedCharacterBoxCharacterBases10R1 as Readonly<
  Record<string, CharacterBaseV1 | undefined>
>;
const weaponBases = generatedCharacterBoxWeaponBases10R1 as Readonly<
  Record<string, WeaponBaseV1 | undefined>
>;
const echoCatalog = generatedEchoCatalogV1 as EchoLoadoutCatalogV1;

const permanentNodes: Readonly<
  Record<
    string,
    {
      basePercent?: Partial<Record<"hp" | "attack" | "defense", number>>;
      critRate?: number;
      critDamage?: number;
    }
  >
> = {
  aemeath: { basePercent: { attack: 12 }, critRate: 8 },
  calcharo: { basePercent: { attack: 12 }, critDamage: 16 },
  changli: { basePercent: { attack: 12 }, critRate: 8 },
};

const blazingBrillianceAtk = { 1: 12, 2: 15, 3: 18, 4: 21, 5: 24 } as const;
const lustrousRazorEr = { 1: 12.8, 2: 16, 3: 19.2, 4: 22.4, 5: 25.6 } as const;

function blankStats(): FinalStats {
  return {
    hp: 0,
    attack: 0,
    defense: 0,
    critRate: 5,
    critDamage: 150,
    energyRegen: 100,
    healingBonus: 0,
    tuneBreakBoost: 0,
    elementalDamageBonus: {
      aero: 0,
      glacio: 0,
      electro: 0,
      fusion: 0,
      havoc: 0,
      spectro: 0,
    },
    damageTypeBonus: {
      basicAttack: 0,
      heavyAttack: 0,
      resonanceSkill: 0,
      resonanceLiberation: 0,
      introSkill: 0,
      echoSkill: 0,
    },
  };
}

function mainEchoId(
  preset: (typeof generatedCommunityEchoPresets10R1)[keyof typeof generatedCommunityEchoPresets10R1],
): string | undefined {
  return "mainEchoId" in preset.echoLoadout
    ? (preset.echoLoadout.mainEchoId as string | undefined)
    : undefined;
}

/**
 * Materializes panel-compatible permanent sources into UserBuild.finalStats.
 * It is intentionally fail-closed outside reviewed Lv90 roster bases. Runtime
 * and conditional effects remain owned by the combat simulator.
 */
export function materializeCharacterBoxFinalStats10R1(
  build: UserBuild,
): FinalStats | undefined {
  const character = characterBases[build.resonatorId];
  const weapon = weaponBases[build.weapon.weaponId];
  if (
    !character ||
    !weapon ||
    build.characterLevel !== character.level ||
    build.weapon.level !== weapon.level ||
    weapon.type !== character.weaponType ||
    !build.echoLoadout
  ) {
    return undefined;
  }

  const echo = resolveEchoLoadoutV1(echoCatalog, build.echoLoadout);
  const stats = blankStats();
  const basePercent = {
    hp: echo.contributions.basePercent.hp,
    attack: echo.contributions.basePercent.attack,
    defense: echo.contributions.basePercent.defense,
  };

  const secondary = weapon.secondaryStat;
  if (secondary) {
    switch (secondary.stat) {
      case "ATK":
        basePercent.attack += secondary.value;
        break;
      case "HP":
        basePercent.hp += secondary.value;
        break;
      case "DEF":
        basePercent.defense += secondary.value;
        break;
      case "Crit. Rate":
        stats.critRate += secondary.value;
        break;
      case "Crit. DMG":
        stats.critDamage += secondary.value;
        break;
      case "Energy Regen":
        stats.energyRegen += secondary.value;
        break;
      default:
        return undefined;
    }
  }

  const nodes = permanentNodes[build.resonatorId];
  if (nodes?.basePercent?.hp) basePercent.hp += nodes.basePercent.hp;
  if (nodes?.basePercent?.attack) basePercent.attack += nodes.basePercent.attack;
  if (nodes?.basePercent?.defense) basePercent.defense += nodes.basePercent.defense;
  stats.critRate += nodes?.critRate ?? 0;
  stats.critDamage += nodes?.critDamage ?? 0;

  if (build.weapon.weaponId === "blazing-brilliance") {
    basePercent.attack += blazingBrillianceAtk[build.weapon.rank];
  }
  if (build.weapon.weaponId === "lustrous-razor") {
    stats.energyRegen += lustrousRazorEr[build.weapon.rank];
  }

  stats.hp =
    character.hp * (1 + basePercent.hp / 100) + echo.contributions.flat.hp;
  stats.attack =
    (character.attack + weapon.attack) * (1 + basePercent.attack / 100) +
    echo.contributions.flat.attack;
  stats.defense =
    character.defense * (1 + basePercent.defense / 100) + echo.contributions.flat.defense;

  const points = echo.contributions.percentagePoints;
  stats.critRate += points.critRate;
  stats.critDamage += points.critDamage;
  stats.energyRegen += points.energyRegen;
  stats.healingBonus += points.healingBonus;
  for (const element of Object.keys(stats.elementalDamageBonus) as Array<
    keyof FinalStats["elementalDamageBonus"]
  >) {
    stats.elementalDamageBonus[element] += points.elementalDamageBonus[element];
  }
  for (const damageType of Object.keys(points.damageTypeBonus) as Array<
    keyof typeof points.damageTypeBonus
  >) {
    stats.damageTypeBonus[damageType] += points.damageTypeBonus[damageType];
  }

  const pieceCounts = echo.sonataPieceCounts;
  const { sonata } = personalDpsRuntimeIdentities10R1;
  if ((pieceCounts[sonata.trailblazingStar] ?? 0) >= 2) {
    stats.elementalDamageBonus.fusion += 10;
  }
  if ((pieceCounts[sonata.voidThunder] ?? 0) >= 2) {
    stats.elementalDamageBonus.electro += 10;
  }
  if ((pieceCounts[sonata.moltenRift] ?? 0) >= 2) {
    stats.elementalDamageBonus.fusion += 10;
  }

  const selectedMainEcho = build.echoLoadout.mainEchoId;
  const aemeathMain = mainEchoId(generatedCommunityEchoPresets10R1.aemeath);
  const calcharoMain = mainEchoId(generatedCommunityEchoPresets10R1.calcharo);
  if (selectedMainEcho && selectedMainEcho === aemeathMain && build.resonatorId === "aemeath") {
    stats.damageTypeBonus.resonanceLiberation += 25;
  }
  if (selectedMainEcho && selectedMainEcho === calcharoMain && build.resonatorId === "calcharo") {
    stats.elementalDamageBonus.electro += 12;
    stats.damageTypeBonus.resonanceLiberation += 12;
  }

  return stats;
}

export function materializeCharacterBoxBuild10R1(build: UserBuild): UserBuild {
  const finalStats = materializeCharacterBoxFinalStats10R1(build);
  return finalStats ? { ...build, finalStats } : build;
}
