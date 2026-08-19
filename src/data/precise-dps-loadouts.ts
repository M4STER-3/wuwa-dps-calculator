import type { Resonator, Weapon } from "@/domain/models";
import { applyPreciseDeniaMechanics } from "./precise-dps-denia";
import { preciseDpsFutureResonators, preciseDpsFutureWeapons } from "./precise-dps-future";
import { applyPreciseResourceMechanics } from "./precise-dps-resource-mechanics";
import { applyPreciseWeaponMechanics } from "./precise-dps-weapons";

export type PreciseDpsLoadoutWeapon = {
  resonatorId: string;
  weapon: Weapon;
};

export const preciseDpsLoadoutResonators: readonly Resonator[] = preciseDpsFutureResonators.map(
  (resonator) => applyPreciseDeniaMechanics(applyPreciseResourceMechanics(resonator)),
);

export const preciseDpsLoadoutWeapons: readonly PreciseDpsLoadoutWeapon[] = preciseDpsLoadoutResonators.map((resonator, index) => {
  const baseWeapon = preciseDpsFutureWeapons[index];
  if (!baseWeapon) throw new Error(`Missing precise weapon for ${resonator.id}.`);
  if (baseWeapon.type !== resonator.weaponType) throw new Error(`Precise weapon type mismatch for ${resonator.id}.`);
  return { resonatorId: resonator.id, weapon: applyPreciseWeaponMechanics(resonator.id, baseWeapon) };
});

export function findPreciseDpsResonator(resonatorId: string): Resonator | undefined {
  return preciseDpsLoadoutResonators.find((entry) => entry.id === resonatorId);
}

export function findPreciseDpsWeapon(resonatorId: string): Weapon | undefined {
  return preciseDpsLoadoutWeapons.find((entry) => entry.resonatorId === resonatorId)?.weapon;
}
