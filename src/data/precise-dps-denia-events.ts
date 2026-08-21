import type { CombatEffect, Resonator, Weapon } from "@/domain/models";
import type { CombatPredicate, EffectDefinition } from "@/domain/effect-models";

const normalize = (value: string): string =>
  value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

const hasTokens = (value: string, tokens: readonly string[]): boolean => {
  const haystack = normalize(value);
  return tokens.every((token) => haystack.includes(normalize(token)));
};

const sequenceAtLeast = (value: number): CombatPredicate => ({
  kind: "state-active",
  id: `sequence-at-least-${value}`,
});

const modeIs = (mode: "fusion-burst" | "tune-strain"): CombatPredicate => ({
  kind: "identity",
  field: "resonanceMode",
  anyOf: [mode],
});

const actionPredicate = (ids: readonly string[]): CombatPredicate => ({
  kind: "identity",
  field: "actionId",
  anyOf: ids,
});

const combatEffect = (
  id: string,
  name: string,
  trigger: string,
  structuredEffect: EffectDefinition,
): CombatEffect => ({
  id,
  name,
  sourceId: structuredEffect.source.id,
  trigger,
  target: structuredEffect.target === "team" ? "team" : "self",
  effect: structuredEffect.label,
  source: {
    kind: "multi-source-verified",
    source: "WUWA GameDatabase / Prydwen / WutheringTools Denia event semantics",
    gameVersion: "3.5",
    verifiedAt: "2026-08-21",
  },
  structuredEffect,
});

function matchingActionIds(resonator: Resonator): readonly string[] {
  const actions = resonator.combat?.actions ?? [];
  const matches = actions.filter((action) => {
    const name = action.name;
    return (
      hasTokens(name, ["It's Been A While"]) ||
      hasTokens(name, ["Knock Knock"]) ||
      hasTokens(name, ["Final Act", "Stagecraft Form"]) ||
      hasTokens(name, ["Final Act", "Breakdown Form"]) ||
      hasTokens(name, ["Erosion Field"]) ||
      hasTokens(name, ["Basic Attack", "Stagecraft Form", "Stage 3"]) ||
      hasTokens(name, ["Basic Attack", "Stagecraft Form", "Stage 4"]) ||
      hasTokens(name, ["Basic Attack", "Breakdown Form", "Stage 3"]) ||
      hasTokens(name, ["Basic Attack", "Breakdown Form", "Stage 4"]) ||
      hasTokens(name, ["Mid-air Attack", "Breakdown Form", "Stage 3"]) ||
      hasTokens(name, ["Mid-air Attack", "Breakdown Form", "Stage 4"])
    );
  });
  if (matches.length < 10) {
    throw new Error(`Denia mode application bridge expected at least 10 exact actions, got ${matches.length}.`);
  }
  return matches.map((action) => action.id);
}

export function applyPreciseDeniaEventMechanics(resonator: Resonator): Resonator {
  if (resonator.id !== "denia" || !resonator.combat) return resonator;
  const applicationActionIds = matchingActionIds(resonator);

  const applicationBridge: EffectDefinition = {
    id: "precise-denia-mode-application-events",
    label: "Denia · structured Fusion Burst / Tune Strain application events",
    source: { id: "denia", type: "resonator", label: "Denia Resonance Mode applications" },
    target: "self",
    activationPolicy: "initially-active",
    lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
    rules: [],
    triggers: [
      {
        id: "denia-emit-fusion-burst-application",
        event: "action-end",
        predicates: [modeIs("fusion-burst"), actionPredicate(applicationActionIds)],
        operations: [{ kind: "emit-event", eventKind: "fusion-burst", delaySeconds: 0 }],
      },
      {
        id: "denia-emit-tune-strain-shifting-application",
        event: "action-end",
        predicates: [modeIs("tune-strain"), actionPredicate(applicationActionIds)],
        operations: [{ kind: "emit-event", eventKind: "custom", delaySeconds: 0 }],
      },
    ],
  };

  const s1EntryEntropy: EffectDefinition = {
    id: "precise-denia-s1-entry-entropy",
    label: "S1 · combat-entry Entropy Shift",
    source: { id: "denia-chain", type: "resonance-chain", label: "Denia S1" },
    target: "self",
    rules: [],
    triggers: [
      {
        id: "denia-s1-entry-stagecraft-entropy",
        event: "rotation-step-start",
        predicates: [
          sequenceAtLeast(1),
          { kind: "identity", field: "form", anyOf: ["Stagecraft Form"] },
        ],
        maxTriggers: 1,
        operations: [{ kind: "activate-effect", effectId: "precise-denia-entropy-stagecraft" }],
      },
      {
        id: "denia-s1-entry-breakdown-entropy",
        event: "rotation-step-start",
        predicates: [
          sequenceAtLeast(1),
          { kind: "identity", field: "form", anyOf: ["Breakdown Form"] },
        ],
        maxTriggers: 1,
        operations: [{ kind: "activate-effect", effectId: "precise-denia-entropy-breakdown" }],
      },
    ],
  };

  const s2FusionWindow: EffectDefinition = {
    id: "precise-denia-s2-fusion-applier-window",
    label: "S2 · Fusion Burst applier Fusion DMG Bonus",
    source: { id: "denia-chain", type: "resonance-chain", label: "Denia S2" },
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 15 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
    },
    rules: [
      {
        id: "denia-s2-fusion-applier-fusion-bonus",
        label: "S2 · after this Resonator inflicts Fusion Burst, +50% Fusion DMG for 15s",
        accounting: "runtime",
        requiredSequence: 2,
        selectors: [{ kind: "element", anyOf: ["fusion"] }],
        modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 50 }],
      },
    ],
  };

  const s2TuneWindow: EffectDefinition = {
    id: "precise-denia-s2-tune-applier-window",
    label: "S2 · Tune Strain applier Tune Break Boost",
    source: { id: "denia-chain", type: "resonance-chain", label: "Denia S2" },
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 15 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
    },
    rules: [
      {
        id: "denia-s2-tune-applier-break-boost",
        label: "S2 · after this Resonator inflicts Tune Strain - Shifting, +20 Tune Break Boost for 15s",
        accounting: "runtime",
        requiredSequence: 2,
        modifiers: [{
          kind: "runtime-stat",
          stat: "tuneBreakBoost",
          mode: "flat",
          stacking: "additive",
          value: { kind: "constant", value: 20 },
        }],
      },
    ],
  };

  const sequenceEventBridge: EffectDefinition = {
    id: "precise-denia-sequence-application-bridge",
    label: "Denia S2 · application-triggered personal windows",
    source: { id: "denia-chain", type: "resonance-chain", label: "Denia S2" },
    target: "self",
    rules: [],
    triggers: [
      {
        id: "denia-s2-fusion-window-on-own-application",
        event: "fusion-burst",
        predicates: [sequenceAtLeast(2), modeIs("fusion-burst"), actionPredicate(applicationActionIds)],
        operations: [{ kind: "activate-effect", effectId: s2FusionWindow.id }],
      },
      {
        id: "denia-s2-tune-window-on-own-application",
        event: "custom",
        predicates: [sequenceAtLeast(2), modeIs("tune-strain"), actionPredicate(applicationActionIds)],
        operations: [{ kind: "activate-effect", effectId: s2TuneWindow.id }],
      },
    ],
  };

  const effects = [
    combatEffect("denia-mode-application-events", "Denia Resonance Mode application bridge", "reviewed damage actions", applicationBridge),
    combatEffect("denia-s1-entry-entropy", "S1 combat-entry Entropy Shift", "combat entry", s1EntryEntropy),
    combatEffect("denia-s2-fusion-window", "S2 Fusion applier window", "Fusion Burst application", s2FusionWindow),
    combatEffect("denia-s2-tune-window", "S2 Tune applier window", "Tune Strain - Shifting application", s2TuneWindow),
    combatEffect("denia-s2-application-bridge", "S2 application trigger bridge", "structured mode application", sequenceEventBridge),
  ] as const;

  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      effects: [...resonator.combat.effects, ...effects],
      unknowns: [
        ...resonator.combat.unknowns,
        "Team-Cycle owned: S2 Fusion Burst resolution stacks/RES-ignore, S2 target Off-Tune refill, Etched Colors Off-Tune-overflow scaling, and teammate-owned applications require explicit target/team events.",
      ],
    },
  };
}

export function applyPreciseDeniaWeaponEventMechanics(
  resonator: Resonator,
  weapon: Weapon,
): Weapon {
  if (resonator.id !== "denia") return weapon;
  const applicationActionIds = matchingActionIds(resonator);
  return {
    ...weapon,
    effects: (weapon.effects ?? []).map((effect) => {
      const definition = effect.structuredEffect;
      if (!definition) return effect;
      if (definition.id === "precise-forged-dwarf-star-liberation-window") {
        return {
          ...effect,
          structuredEffect: {
            ...definition,
            triggers: [
              ...(definition.triggers ?? []),
              {
                id: "forged-window-on-tune-strain-shifting",
                event: "custom" as const,
                predicates: [modeIs("tune-strain"), actionPredicate(applicationActionIds)],
                operations: [{ kind: "activate-effect" as const, effectId: definition.id }],
              },
            ],
          },
        };
      }
      if (definition.id === "precise-forged-dwarf-star-team-atk-window") {
        return {
          ...effect,
          structuredEffect: {
            ...definition,
            triggers: [
              ...(definition.triggers ?? []),
              {
                id: "forged-team-atk-on-tune-strain-during-window",
                event: "custom" as const,
                predicates: [
                  modeIs("tune-strain"),
                  actionPredicate(applicationActionIds),
                  { kind: "has-effect" as const, id: "precise-forged-dwarf-star-liberation-window" },
                ],
                operations: [{ kind: "activate-effect" as const, effectId: definition.id }],
              },
            ],
          },
        };
      }
      return effect;
    }),
  };
}
