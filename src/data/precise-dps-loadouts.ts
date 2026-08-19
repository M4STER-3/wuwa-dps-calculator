import type { Resonator, Weapon } from "@/domain/models";
import { applyPreciseDeniaMechanics } from "./precise-dps-denia";
import { preciseDpsFutureResonators, preciseDpsFutureWeapons } from "./precise-dps-future";
import {
  applyPreciseGalbrenaActionPatches,
  applyPreciseGalbrenaMechanics,
  applyPreciseGalbrenaWeaponMechanics,
} from "./precise-dps-galbrena";
import { applyGalbrenaReferenceDuration } from "./precise-dps-galbrena-scenario";
import { applyPreciseInitialStateAnchors } from "./precise-dps-initial-state-anchors";
import {
  applyPreciseJinhsiMechanics,
  applyPreciseJinhsiWeaponMechanics,
} from "./precise-dps-jinhsi";
import { applyPrecisePhrolovaAftersoundMechanics } from "./precise-dps-phrolova-aftersound";
import { applyPrecisePhrolovaCorrections } from "./precise-dps-phrolova-corrections";
import {
  applyPrecisePhrolovaMechanics,
  applyPrecisePhrolovaWeaponMechanics,
} from "./precise-dps-phrolova";
import { applyPrecisePhrolovaTeamCycleMechanics } from "./precise-dps-phrolova-team";
import {
  applyPreciseQiuyuanMechanics,
  applyPreciseQiuyuanWeaponMechanics,
} from "./precise-dps-qiuyuan";
import {
  normalizeExplicitWeaponRatioPercentRules,
  type RatioPercentRulePatch,
} from "./precise-dps-ratio-units";
import { applyPreciseResourceMechanics } from "./precise-dps-resource-mechanics";
import {
  applyPreciseShorekeeperMechanics,
  applyPreciseShorekeeperWeaponMechanics,
} from "./precise-dps-shorekeeper";
import { applyPreciseWeaponMechanics } from "./precise-dps-weapons";

export type PreciseDpsLoadoutWeapon = {
  resonatorId: string;
  weapon: Weapon;
};

const phrolovaRatioPatches: readonly RatioPercentRulePatch[] = [
  {
    effectId: "precise-lethean-window",
    ruleId: "lethean-defense-ignore",
    kind: "defense-ignore",
  },
];

const galbrenaRatioPatches: readonly RatioPercentRulePatch[] = [
  {
    effectId: "precise-lux-umbra-both-windows",
    ruleId: "lux-umbra-defense-ignore",
    kind: "defense-ignore",
  },
];

function applyGalbrenaLoadoutMechanics(resonator: Resonator): Resonator {
  if (resonator.id !== "galbrena" || !resonator.combat) return resonator;
  const withActions: Resonator = {
    ...resonator,
    combat: {
      ...resonator.combat,
      actions: applyPreciseGalbrenaActionPatches(resonator.combat.actions),
    },
  };
  return applyGalbrenaReferenceDuration(applyPreciseGalbrenaMechanics(withActions));
}

export const preciseDpsLoadoutResonators: readonly Resonator[] = preciseDpsFutureResonators.map(
  (resonator) =>
    applyPreciseInitialStateAnchors(
      applyPreciseShorekeeperMechanics(
        applyPrecisePhrolovaCorrections(
          applyPrecisePhrolovaAftersoundMechanics(
            applyPrecisePhrolovaTeamCycleMechanics(
              applyPrecisePhrolovaMechanics(
                applyGalbrenaLoadoutMechanics(
                  applyPreciseQiuyuanMechanics(
                    applyPreciseJinhsiMechanics(
                      applyPreciseDeniaMechanics(applyPreciseResourceMechanics(resonator)),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
);

export const preciseDpsLoadoutWeapons: readonly PreciseDpsLoadoutWeapon[] = preciseDpsLoadoutResonators.map((resonator, index) => {
  const baseWeapon = preciseDpsFutureWeapons[index];
  if (!baseWeapon) throw new Error(`Missing precise weapon for ${resonator.id}.`);
  if (baseWeapon.type !== resonator.weaponType) throw new Error(`Precise weapon type mismatch for ${resonator.id}.`);
  const genericWeapon = applyPreciseWeaponMechanics(resonator.id, baseWeapon);
  const jinhsiWeapon = applyPreciseJinhsiWeaponMechanics(resonator.id, genericWeapon);
  const qiuyuanWeapon = applyPreciseQiuyuanWeaponMechanics(resonator.id, jinhsiWeapon);
  const phrolovaWeapon = applyPrecisePhrolovaWeaponMechanics(resonator.id, qiuyuanWeapon);
  const galbrenaWeapon = applyPreciseGalbrenaWeaponMechanics(resonator.id, phrolovaWeapon);
  const ratioNormalizedWeapon = resonator.id === "phrolova"
    ? normalizeExplicitWeaponRatioPercentRules(galbrenaWeapon, phrolovaRatioPatches)
    : resonator.id === "galbrena"
      ? normalizeExplicitWeaponRatioPercentRules(galbrenaWeapon, galbrenaRatioPatches)
      : galbrenaWeapon;
  return {
    resonatorId: resonator.id,
    weapon: applyPreciseShorekeeperWeaponMechanics(resonator.id, ratioNormalizedWeapon),
  };
});

export function findPreciseDpsResonator(resonatorId: string): Resonator | undefined {
  return preciseDpsLoadoutResonators.find((entry) => entry.id === resonatorId);
}

export function findPreciseDpsWeapon(resonatorId: string): Weapon | undefined {
  return preciseDpsLoadoutWeapons.find((entry) => entry.resonatorId === resonatorId)?.weapon;
}
