import type { CombatEffect, Weapon } from "@/domain/models";
import type { EffectDefinition, ValueExpression } from "@/domain/effect-models";

const rank = (values: readonly [number, number, number, number, number]): ValueExpression => ({
  kind: "rank",
  values: { 1: values[0], 2: values[1], 3: values[2], 4: values[3], 5: values[4] },
});
const constant = (value: number): ValueExpression => ({ kind: "constant", value });
const actionPredicate = (...ids: string[]) => ({
  kind: "identity" as const,
  field: "actionId" as const,
  anyOf: ids,
});
const effect = (id: string, name: string, trigger: string, structuredEffect: EffectDefinition): CombatEffect => ({
  id,
  name,
  sourceId: structuredEffect.source.id,
  trigger,
  target: structuredEffect.target === "team" ? "team" : "self",
  effect: structuredEffect.label,
  source: {
    kind: "multi-source-verified",
    source: "WUWA GameDatabase / current weapon references",
    gameVersion: "3.x",
    verifiedAt: "2026-08-19",
  },
  structuredEffect,
});

const LYNAE = {
  intro: "precise-lynae-attr-1509029",
  leap1: "precise-lynae-attr-1509020",
  leap2: "precise-lynae-attr-1509021",
  leap3: "precise-lynae-attr-1509022",
  visual: "precise-lynae-attr-1509009",
  iridescent: "precise-lynae-attr-1509008",
} as const;
const lynaeBasicShiftingActions = [LYNAE.leap1, LYNAE.leap2, LYNAE.leap3, LYNAE.visual, LYNAE.iridescent] as const;

const spectrumPermanent: EffectDefinition = {
  id: "precise-spectrum-blaster-permanent",
  label: "Spectrum Blaster · permanent ATK",
  source: { id: "precise-lynae-signature", type: "weapon", label: "Spectrum Blaster" },
  target: "self",
  activationPolicy: "initially-active",
  rules: [{
    id: "spectrum-atk",
    label: "ATK +12/15/18/21/24%",
    accounting: "already-in-final-stats",
    modifiers: [{
      kind: "runtime-stat",
      stat: "attack",
      mode: "percent",
      stacking: "additive",
      value: rank([12, 15, 18, 21, 24]),
    }],
  }],
};

const spectrumBasicWindow: EffectDefinition = {
  id: "precise-spectrum-blaster-basic-window",
  label: "Spectrum Blaster · Basic Attack DMG window",
  source: { id: "precise-lynae-signature", type: "weapon", label: "Spectrum Blaster" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 4 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [{
    id: "spectrum-basic-dmg",
    label: "Basic Attack DMG +36/45/54/63/72% for 4s",
    accounting: "runtime",
    selectors: [{ kind: "damage-type", anyOf: ["basicAttack"] }],
    modifiers: [{
      kind: "damage-type-bonus",
      stacking: "additive",
      valueExpression: rank([36, 45, 54, 63, 72]),
    }],
  }],
  triggers: [
    {
      id: "spectrum-window-on-intro",
      event: "action-start",
      predicates: [actionPredicate(LYNAE.intro)],
      operations: [{ kind: "activate-effect", effectId: "precise-spectrum-blaster-basic-window" }],
    },
    {
      id: "spectrum-window-on-reviewed-basic-hit",
      event: "action-end",
      predicates: [actionPredicate(...lynaeBasicShiftingActions)],
      operations: [{ kind: "activate-effect", effectId: "precise-spectrum-blaster-basic-window" }],
    },
  ],
};

const spectrumTeamStacks: EffectDefinition = {
  id: "precise-spectrum-blaster-team-stacks",
  label: "Spectrum Blaster · Shifting team All-DMG stacks",
  source: { id: "precise-lynae-signature", type: "weapon", label: "Spectrum Blaster" },
  target: "team",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
    stacks: { kind: "shared", max: 3, initial: 0 },
  },
  rules: [{
    id: "spectrum-team-all-dmg",
    label: "All-DMG +8/10/12/14/16% per stack, max 3",
    accounting: "runtime",
    modifiers: [{
      kind: "all-damage-bonus",
      stacking: "additive",
      valueExpression: {
        kind: "multiply",
        values: [{ kind: "stacks" }, rank([8, 10, 12, 14, 16])],
      },
    }],
  }],
  triggers: [{
    id: "spectrum-stack-on-basic-shifting",
    event: "action-end",
    predicates: [actionPredicate(...lynaeBasicShiftingActions)],
    operations: [
      { kind: "activate-effect", effectId: "precise-spectrum-blaster-team-stacks" },
      { kind: "gain-stacks", effectId: "precise-spectrum-blaster-team-stacks", amount: constant(1) },
    ],
  }],
};

const MORN = {
  liberation: "precise-mornye-attr-1209021",
} as const;

const starfieldPermanent: EffectDefinition = {
  id: "precise-starfield-calibrator-permanent",
  label: "Starfield Calibrator · permanent DEF",
  source: { id: "precise-mornye-signature", type: "weapon", label: "Starfield Calibrator" },
  target: "self",
  activationPolicy: "initially-active",
  rules: [{
    id: "starfield-def",
    label: "DEF +16/20/24/28/32%",
    accounting: "already-in-final-stats",
    modifiers: [{
      kind: "runtime-stat",
      stat: "defense",
      mode: "percent",
      stacking: "additive",
      value: rank([16, 20, 24, 28, 32]),
    }],
  }],
};

const starfieldConcerto: EffectDefinition = {
  id: "precise-starfield-calibrator-concerto",
  label: "Starfield Calibrator · Concerto restoration",
  source: { id: "precise-mornye-signature", type: "weapon", label: "Starfield Calibrator" },
  target: "self",
  teamContextRequired: true,
  rules: [{
    id: "starfield-concerto-pending",
    label: "Restore 8/10/12/14/16 Concerto Energy; exact source trigger conflict remains fail-closed",
    accounting: "informational",
    modifiers: [],
  }],
  triggers: [{
    id: "starfield-concerto-reviewed-liberation-candidate",
    event: "action-start",
    predicates: [actionPredicate(MORN.liberation)],
    cooldown: { seconds: 20, scope: "owner" },
    externalContextRequired: true,
    operations: [],
  }],
};

const starfieldCritWindow: EffectDefinition = {
  id: "precise-starfield-calibrator-crit-window",
  label: "Starfield Calibrator · healing Crit DMG window",
  source: { id: "precise-mornye-signature", type: "weapon", label: "Starfield Calibrator" },
  target: "team",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 4 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [{
    id: "starfield-team-crit-dmg",
    label: "Team Crit DMG +20/25/30/35/40% for 4s",
    accounting: "runtime",
    modifiers: [{
      kind: "crit-damage-bonus",
      stacking: "highest",
      valueExpression: rank([20, 25, 30, 35, 40]),
    }],
  }],
  triggers: [{
    id: "starfield-heal-context-required",
    event: "heal-applied",
    externalContextRequired: true,
    operations: [{ kind: "activate-effect", effectId: "precise-starfield-calibrator-crit-window" }],
  }],
};

const forgedPermanent: EffectDefinition = {
  id: "precise-forged-dwarf-star-permanent",
  label: "Forged Dwarf Star · permanent ATK",
  source: { id: "precise-denia-signature", type: "weapon", label: "Forged Dwarf Star" },
  target: "self",
  activationPolicy: "initially-active",
  rules: [{
    id: "forged-atk",
    label: "ATK +12/15/18/21/24%",
    accounting: "already-in-final-stats",
    modifiers: [{
      kind: "runtime-stat",
      stat: "attack",
      mode: "percent",
      stacking: "additive",
      value: rank([12, 15, 18, 21, 24]),
    }],
  }],
};

const forgedLiberationWindow: EffectDefinition = {
  id: "precise-forged-dwarf-star-liberation-window",
  label: "Forged Dwarf Star · Liberation DMG window",
  source: { id: "precise-denia-signature", type: "weapon", label: "Forged Dwarf Star" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 5 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [{
    id: "forged-liberation-dmg",
    label: "Resonance Liberation DMG +36/45/54/63/72% for 5s",
    accounting: "runtime",
    selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }],
    modifiers: [{
      kind: "damage-type-bonus",
      stacking: "additive",
      valueExpression: rank([36, 45, 54, 63, 72]),
    }],
  }],
  triggers: [{
    id: "forged-window-on-fusion-burst",
    event: "fusion-burst",
    operations: [{ kind: "activate-effect", effectId: "precise-forged-dwarf-star-liberation-window" }],
  }],
};

const forgedTeamAtkWindow: EffectDefinition = {
  id: "precise-forged-dwarf-star-team-atk-window",
  label: "Forged Dwarf Star · team ATK window",
  source: { id: "precise-denia-signature", type: "weapon", label: "Forged Dwarf Star" },
  target: "team",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 15 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [{
    id: "forged-team-atk",
    label: "Team ATK +24/30/36/42/48% for 15s",
    accounting: "runtime",
    modifiers: [{
      kind: "runtime-stat",
      stat: "attack",
      mode: "percent",
      stacking: "additive",
      value: rank([24, 30, 36, 42, 48]),
    }],
  }],
  triggers: [{
    id: "forged-team-atk-on-fusion-burst-during-window",
    event: "fusion-burst",
    predicates: [{ kind: "has-effect", id: "precise-forged-dwarf-star-liberation-window" }],
    operations: [{ kind: "activate-effect", effectId: "precise-forged-dwarf-star-team-atk-window" }],
  }],
};

const forgedTuneStrainPending: EffectDefinition = {
  id: "precise-forged-dwarf-star-tune-strain-pending",
  label: "Forged Dwarf Star · Tune Strain trigger path pending",
  source: { id: "precise-denia-signature", type: "weapon", label: "Forged Dwarf Star" },
  target: "self",
  teamContextRequired: true,
  rules: [{
    id: "forged-tune-strain-trigger-pending",
    label: "Tune Strain - Shifting must activate the same 5s/15s windows once Denia emits a structured Shifting event.",
    accounting: "informational",
    modifiers: [],
  }],
};

const spectrumEffects: readonly CombatEffect[] = [
  effect("spectrum-permanent", "Attendance Exemption Protocol · ATK", "permanent", spectrumPermanent),
  effect("spectrum-basic-window", "Attendance Exemption Protocol · Basic window", "Intro / Basic hit", spectrumBasicWindow),
  effect("spectrum-team-stacks", "Attendance Exemption Protocol · Shifting stacks", "Basic Shifting", spectrumTeamStacks),
];
const starfieldEffects: readonly CombatEffect[] = [
  effect("starfield-permanent", "Definite Solution · DEF", "permanent", starfieldPermanent),
  effect("starfield-concerto", "Definite Solution · Concerto", "reviewed trigger pending GameDatabase conflict resolution", starfieldConcerto),
  effect("starfield-crit-window", "Definite Solution · team Crit DMG", "healing", starfieldCritWindow),
];
const forgedEffects: readonly CombatEffect[] = [
  effect("forged-permanent", "Dissolution · ATK", "permanent", forgedPermanent),
  effect("forged-liberation-window", "Dissolution · Liberation window", "Fusion Burst / Tune Strain - Shifting", forgedLiberationWindow),
  effect("forged-team-atk", "Dissolution · team ATK", "team Fusion Burst / Tune Strain - Shifting", forgedTeamAtkWindow),
  effect("forged-tune-strain-pending", "Dissolution · Tune Strain path", "structured Shifting pending", forgedTuneStrainPending),
];

export function applyPreciseWeaponMechanics(resonatorId: string, weapon: Weapon): Weapon {
  if (resonatorId === "lynae") {
    return {
      ...weapon,
      level90Stats: { ...weapon.level90Stats!, critRate: 24.3 },
      effects: spectrumEffects,
      passiveDescription: "Partiel · Spectrum Blaster R1–R5 structuré. ATK permanent reste upstream dans finalStats; fenêtres Basic/Shifting sont runtime.",
    };
  }
  if (resonatorId === "mornye") {
    return {
      ...weapon,
      level90Stats: { ...weapon.level90Stats!, energyRegen: 77.04 },
      effects: starfieldEffects,
      passiveDescription: "Partiel · Starfield Calibrator R1–R5 structuré. DEF permanent reste upstream; soin/Concerto exigent leur vrai contexte d'événement.",
    };
  }
  if (resonatorId === "denia") {
    return {
      ...weapon,
      level90Stats: { ...weapon.level90Stats!, critRate: 36 },
      effects: forgedEffects,
      passiveDescription: "Partiel · Forged Dwarf Star R1–R5 structuré. Fusion Burst est exécutable; Tune Strain attend l'événement Shifting structuré; ATK permanent reste upstream.",
    };
  }
  return weapon;
}