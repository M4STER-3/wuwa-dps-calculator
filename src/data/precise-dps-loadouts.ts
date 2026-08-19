import type { Resonator, Weapon } from "@/domain/models";
import { applyPreciseDeniaMechanics } from "./precise-dps-denia";
import { preciseDpsFutureResonators, preciseDpsFutureWeapons } from "./precise-dps-future";
import { applyPreciseInitialStateAnchors } from "./precise-dps-initial-state-anchors";
import {
  applyPreciseJinhsiMechanics,
  applyPreciseJinhsiWeaponMechanics,
} from "./precise-dps-jinhsi";
import {
  applyPrecisePhrolovaMechanics,
  applyPrecisePhrolovaWeaponMechanics,
} from "./precise-dps-phrolova";
import { applyPrecisePhrolovaTeamCycleMechanics } from "./precise-dps-phrolova-team";
import {
  applyPreciseQiuyuanMechanics,
  applyPreciseQiuyuanWeaponMechanics,
} from "./precise-dps-qiuyuan";
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

export const preciseDpsLoadoutResonators: readonly Resonator[] = preciseDpsFutureResonators.map(
  (resonator) =>
    applyPreciseInitialStateAnchors(
      applyPreciseShorekeeperMechanics(
        applyPrecisePhrolovaTeamCycleMechanics(
          applyPrecisePhrolovaMechanics(
            applyPreciseQiuyuanMechanics(
              applyPreciseJinhsiMechanics(
                applyPreciseDeniaMechanics(applyPreciseResourceMechanics(resonator)),
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
  return {
    resonatorId: resonator.id,
    weapon: applyPreciseShorekeeperWeaponMechanics(resonator.id, phrolovaWeapon),
  };
});

export function findPreciseDpsResonator(resonatorId: string): Resonator | undefined {
  return preciseDpsLoadoutResonators.find((entry) => entry.id === resonatorId);
}

export function findPreciseDpsWeapon(resonatorId: string): Weapon | undefined {
  return preciseDpsLoadoutWeapons.find((entry) => entry.resonatorId === resonatorId)?.weapon;
}
