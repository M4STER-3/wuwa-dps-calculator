import type { EffectDefinition, ValueExpression } from "@/domain/effect-models";
import type { UserBuild } from "@/domain/models";

const everbrightAllDamageByRank: ValueExpression = {
  kind: "rank",
  values: { 1: 12, 2: 15, 3: 18, 4: 21, 5: 24 },
};

const everbrightPolestarBase: EffectDefinition = {
  id: "weapon-everbright-polestar-base-dps",
  label: "Everbright Polestar · Starchaser",
  source: {
    id: "everbright-polestar",
    type: "weapon",
    label: "Everbright Polestar",
  },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" } },
  rules: [
    {
      id: "everbright-all-attribute",
      label: "All-Attribute DMG Bonus",
      accounting: "runtime",
      modifiers: [
        {
          kind: "all-damage-bonus",
          stacking: "additive",
          valueExpression: everbrightAllDamageByRank,
        },
      ],
    },
  ],
};

const passiveEffectsByWeapon: Readonly<Record<string, readonly EffectDefinition[]>> = {
  "everbright-polestar": [everbrightPolestarBase],
};

/** Non-panel permanent passives stay effects; panel-compatible sources belong in finalStats. */
export function resolvePersonalDpsBuildPassives10R1(
  build: UserBuild,
): readonly EffectDefinition[] {
  return passiveEffectsByWeapon[build.weapon.weaponId] ?? [];
}
