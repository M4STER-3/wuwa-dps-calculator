import type { EffectDefinition } from "@/domain/effect-models";
import type { CombatEffect, Element, Sonata, SonataPieceBonus } from "@/domain/models";

export type PreciseSonataRuntimeCoverage =
  | "personal-complete"
  | "personal-partial"
  | "team-owned"
  | "pending-runtime-context";

export interface PreciseSonataTierCoverage {
  sonataSetId: string;
  pieces: 2 | 3 | 5;
  coverage: PreciseSonataRuntimeCoverage;
  note: string;
}

export const preciseSonataSource = {
  kind: "verified-game-data" as const,
  source: "WUWA LAB GameDatabase V1 · Encore Release",
  gameVersion: "Release dataset generated 2026-08-17",
  verifiedAt: "2026-08-20",
  notes:
    "Exact Sonata ids and tier descriptions are owned by the committed GameDatabase V1. Runtime effects below only encode mechanics that can be executed without inventing missing context.",
};

const effectSource = (id: string, label: string): EffectDefinition["source"] => ({
  id,
  type: "sonata",
  label,
  metadata: preciseSonataSource,
});

const wrapEffect = (
  definition: EffectDefinition,
  description: string,
): CombatEffect => ({
  id: definition.id,
  name: definition.label,
  sourceId: definition.source.id,
  trigger: definition.label,
  target: "self",
  effect: description,
  structuredEffect: definition,
  source: preciseSonataSource,
});

const staticElementalBonus = (
  sonataSetId: string,
  sonataName: string,
  element: Element,
  value: number,
): CombatEffect => {
  const definition: EffectDefinition = {
    id: `${sonataSetId}:2pc:${element}`,
    label: `${sonataName} 2-piece — ${element} DMG`,
    source: effectSource(sonataSetId, sonataName),
    target: "self",
    activationPolicy: "initially-active",
    rules: [
      {
        id: `${sonataSetId}:2pc:${element}:rule`,
        label: `+${value}% ${element} DMG`,
        accounting: "runtime",
        selectors: [{ kind: "element", anyOf: [element] }],
        modifiers: [
          {
            kind: "elemental-damage-bonus",
            stacking: "additive",
            value,
          },
        ],
      },
    ],
  };
  return wrapEffect(definition, `Always-active ${value}% ${element} DMG bonus from the 2-piece tier.`);
};

const staticHealingBonus = (
  sonataSetId: string,
  sonataName: string,
  value: number,
): CombatEffect => {
  const definition: EffectDefinition = {
    id: `${sonataSetId}:2pc:healing`,
    label: `${sonataName} 2-piece — Healing Bonus`,
    source: effectSource(sonataSetId, sonataName),
    target: "self",
    activationPolicy: "initially-active",
    rules: [
      {
        id: `${sonataSetId}:2pc:healing:rule`,
        label: `+${value}% Healing Bonus`,
        accounting: "runtime",
        modifiers: [
          {
            kind: "runtime-stat",
            stat: "healingBonus",
            mode: "flat",
            stacking: "additive",
            value: { kind: "constant", value },
          },
        ],
      },
    ],
  };
  return wrapEffect(definition, `Always-active ${value}% Healing Bonus from the 2-piece tier.`);
};

const staticAttackPercent = (
  sonataSetId: string,
  sonataName: string,
  value: number,
): CombatEffect => {
  const definition: EffectDefinition = {
    id: `${sonataSetId}:2pc:attack`,
    label: `${sonataName} 2-piece — ATK`,
    source: effectSource(sonataSetId, sonataName),
    target: "self",
    activationPolicy: "initially-active",
    rules: [
      {
        id: `${sonataSetId}:2pc:attack:rule`,
        label: `+${value}% ATK`,
        accounting: "runtime",
        modifiers: [
          {
            kind: "runtime-stat",
            stat: "attack",
            mode: "percent",
            stacking: "additive",
            value: { kind: "constant", value },
          },
        ],
      },
    ],
  };
  return wrapEffect(definition, `Always-active ${value}% ATK bonus from the 2-piece tier.`);
};

const lawOfHarmonyHeavy: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:21:3pc:heavy-self",
    label: "Law of Harmony 3-piece — personal Heavy Attack DMG",
    source: effectSource("sonata-set:21", "Law of Harmony"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 4 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
    },
    rules: [
      {
        id: "sonata-set:21:3pc:heavy-self:rule",
        label: "+30% Heavy Attack DMG",
        accounting: "runtime",
        selectors: [{ kind: "damage-type", anyOf: ["heavyAttack"] }],
        modifiers: [
          { kind: "damage-type-bonus", stacking: "additive", value: 30 },
        ],
      },
    ],
    triggers: [
      {
        id: "sonata-set:21:3pc:echo-skill",
        event: "echo-skill",
        operations: [
          {
            kind: "activate-effect",
            effectId: "sonata-set:21:3pc:heavy-self",
          },
        ],
      },
    ],
  };
  return wrapEffect(
    definition,
    "Casting Echo Skill grants the caster +30% Heavy Attack DMG for 4s. The separate team Echo Skill stack component is intentionally not folded into this personal effect.",
  );
})();

const crownOfValorStacks: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:20:3pc:shield-stacks",
    label: "Crown of Valor 3-piece — Shield stacks",
    source: effectSource("sonata-set:20", "Crown of Valor"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 4 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
      stacks: { kind: "shared", max: 5, initial: 0 },
    },
    rules: [
      {
        id: "sonata-set:20:3pc:attack",
        label: "+6% ATK per stack",
        accounting: "runtime",
        modifiers: [
          {
            kind: "runtime-stat",
            stat: "attack",
            mode: "percent",
            stacking: "additive",
            value: {
              kind: "multiply",
              values: [
                { kind: "stacks" },
                { kind: "constant", value: 6 },
              ],
            },
          },
        ],
      },
      {
        id: "sonata-set:20:3pc:crit-damage",
        label: "+4% Crit DMG per stack",
        accounting: "runtime",
        modifiers: [
          {
            kind: "crit-damage-bonus",
            stacking: "additive",
            valueExpression: {
              kind: "multiply",
              values: [
                { kind: "stacks" },
                { kind: "constant", value: 4 },
              ],
            },
          },
        ],
      },
    ],
    triggers: [
      {
        id: "sonata-set:20:3pc:shield-gained",
        event: "shield-gained",
        cooldown: { seconds: 0.5, scope: "owner" },
        operations: [
          {
            kind: "activate-effect",
            effectId: "sonata-set:20:3pc:shield-stacks",
          },
          {
            kind: "gain-stacks",
            effectId: "sonata-set:20:3pc:shield-stacks",
            amount: { kind: "constant", value: 1 },
          },
        ],
      },
    ],
  };
  return wrapEffect(
    definition,
    "Gaining a Shield grants one 4s stack: +6% ATK and +4% Crit DMG, up to 5 stacks, once per 0.5s.",
  );
})();

const flamewingHeavyCrit: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:22:3pc:heavy-crit",
    label: "Flamewing's Shadow 3-piece — Heavy Attack Crit Rate",
    source: effectSource("sonata-set:22", "Flamewing's Shadow"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 6 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
    },
    rules: [
      {
        id: "sonata-set:22:3pc:heavy-crit:rule",
        label: "+20% Heavy Attack Crit Rate",
        accounting: "runtime",
        selectors: [{ kind: "damage-type", anyOf: ["heavyAttack"] }],
        modifiers: [
          { kind: "crit-rate-bonus", stacking: "additive", value: 20 },
        ],
      },
    ],
    triggers: [
      {
        id: "sonata-set:22:3pc:on-echo-damage",
        event: "damage-dealt",
        predicates: [
          {
            kind: "identity",
            field: "damageType",
            anyOf: ["echoSkill"],
          },
        ],
        operations: [
          {
            kind: "activate-effect",
            effectId: "sonata-set:22:3pc:heavy-crit",
          },
        ],
      },
    ],
  };
  return wrapEffect(
    definition,
    "Dealing Echo Skill DMG grants +20% Heavy Attack Crit Rate for 6s.",
  );
})();

const flamewingEchoCrit: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:22:3pc:echo-crit",
    label: "Flamewing's Shadow 3-piece — Echo Skill Crit Rate",
    source: effectSource("sonata-set:22", "Flamewing's Shadow"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 6 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
    },
    rules: [
      {
        id: "sonata-set:22:3pc:echo-crit:rule",
        label: "+20% Echo Skill Crit Rate",
        accounting: "runtime",
        selectors: [{ kind: "damage-type", anyOf: ["echoSkill"] }],
        modifiers: [
          { kind: "crit-rate-bonus", stacking: "additive", value: 20 },
        ],
      },
    ],
    triggers: [
      {
        id: "sonata-set:22:3pc:on-heavy-damage",
        event: "damage-dealt",
        predicates: [
          {
            kind: "identity",
            field: "damageType",
            anyOf: ["heavyAttack"],
          },
        ],
        operations: [
          {
            kind: "activate-effect",
            effectId: "sonata-set:22:3pc:echo-crit",
          },
        ],
      },
    ],
  };
  return wrapEffect(
    definition,
    "Dealing Heavy Attack DMG grants +20% Echo Skill Crit Rate for 6s.",
  );
})();

const celestialLightIntro: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:5:5pc:intro-spectro",
    label: "Celestial Light 5-piece — Intro Spectro DMG",
    source: effectSource("sonata-set:5", "Celestial Light"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 15 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
    },
    rules: [
      {
        id: "sonata-set:5:5pc:intro-spectro:rule",
        label: "+30% Spectro DMG",
        accounting: "runtime",
        selectors: [{ kind: "element", anyOf: ["spectro"] }],
        modifiers: [
          { kind: "elemental-damage-bonus", stacking: "additive", value: 30 },
        ],
      },
    ],
    triggers: [
      {
        id: "sonata-set:5:5pc:intro",
        event: "intro",
        operations: [
          {
            kind: "activate-effect",
            effectId: "sonata-set:5:5pc:intro-spectro",
          },
        ],
      },
    ],
  };
  return wrapEffect(
    definition,
    "Releasing Intro Skill grants +30% Spectro DMG for 15s. It does not activate in scenarios that do not emit an Intro.",
  );
})();

const chromaticFoamPersonal: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:28:5pc:fusion-burst-self",
    label: "Chromatic Foam 5-piece — personal Fusion DMG",
    source: effectSource("sonata-set:28", "Chromatic Foam"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 15 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
    },
    rules: [
      {
        id: "sonata-set:28:5pc:fusion-burst-self:rule",
        label: "+10% Fusion DMG",
        accounting: "runtime",
        selectors: [{ kind: "element", anyOf: ["fusion"] }],
        modifiers: [
          { kind: "elemental-damage-bonus", stacking: "additive", value: 10 },
        ],
      },
    ],
    triggers: [
      {
        id: "sonata-set:28:5pc:fusion-burst",
        event: "fusion-burst",
        operations: [
          {
            kind: "activate-effect",
            effectId: "sonata-set:28:5pc:fusion-burst-self",
          },
        ],
      },
    ],
  };
  return wrapEffect(
    definition,
    "Inflicting Fusion Burst grants the wearer +10% Fusion DMG for 15s. The later Outro bonus belongs to the incoming Resonator and is Team-DPS-owned.",
  );
})();

const rejuvenatingGlowPersonal: CombatEffect = (() => {
  const definition: EffectDefinition = {
    id: "sonata-set:7:5pc:heal-self-atk",
    label: "Rejuvenating Glow 5-piece — personal share of team ATK",
    source: effectSource("sonata-set:7", "Rejuvenating Glow"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 30 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
    },
    rules: [
      {
        id: "sonata-set:7:5pc:heal-self-atk:rule",
        label: "+15% ATK",
        accounting: "runtime",
        modifiers: [
          {
            kind: "runtime-stat",
            stat: "attack",
            mode: "percent",
            stacking: "additive",
            value: { kind: "constant", value: 15 },
          },
        ],
      },
    ],
    triggers: [
      {
        id: "sonata-set:7:5pc:heal-applied",
        event: "heal-applied",
        operations: [
          {
            kind: "activate-effect",
            effectId: "sonata-set:7:5pc:heal-self-atk",
          },
        ],
      },
    ],
  };
  return wrapEffect(
    definition,
    "After the wearer applies healing, the wearer receives the +15% ATK team buff for 30s as a valid team member.",
  );
})();

const midnightVeil: Sonata = {
  id: "sonata-set:12",
  name: "Midnight Veil",
  pieceBonuses: [
    {
      pieces: 2,
      effectDescription: "Havoc DMG +10%.",
      effects: [staticElementalBonus("sonata-set:12", "Midnight Veil", "havoc", 10)],
    },
    {
      pieces: 5,
      effectDescription:
        "Outro triggers additional Havoc Outro DMG and grants the incoming Resonator Havoc DMG Bonus for 15s.",
    },
  ],
  source: preciseSonataSource,
};

const dreamOfTheLost: Sonata = {
  id: "sonata-set:19",
  name: "Dream of the Lost",
  pieceBonuses: [
    {
      pieces: 3,
      effectDescription:
        "Holding 0 Resonance Energy increases Crit. Rate by 20% and grants 35% Echo Skill DMG Bonus.",
    },
  ],
  source: preciseSonataSource,
};

const crownOfValor: Sonata = {
  id: "sonata-set:20",
  name: "Crown of Valor",
  pieceBonuses: [
    {
      pieces: 3,
      effectDescription:
        "Gaining a Shield grants +6% ATK and +4% Crit DMG for 4s, once per 0.5s, up to 5 stacks.",
      effects: [crownOfValorStacks],
    },
  ],
  source: preciseSonataSource,
};

const lawOfHarmony: Sonata = {
  id: "sonata-set:21",
  name: "Law of Harmony",
  pieceBonuses: [
    {
      pieces: 3,
      effectDescription:
        "Casting Echo Skill grants the caster +30% Heavy Attack DMG for 4s and also builds a separate team Echo Skill DMG stack effect.",
      effects: [lawOfHarmonyHeavy],
    },
  ],
  source: preciseSonataSource,
};

const flamewingsShadow: Sonata = {
  id: "sonata-set:22",
  name: "Flamewing's Shadow",
  pieceBonuses: [
    {
      pieces: 3,
      effectDescription:
        "Echo Skill DMG grants +20% Heavy Attack Crit Rate for 6s; Heavy Attack DMG grants +20% Echo Skill Crit Rate for 6s; while both are active gain +16% Fusion DMG.",
      effects: [flamewingHeavyCrit, flamewingEchoCrit],
    },
  ],
  source: preciseSonataSource,
};

const pactOfNeonlightLeap: Sonata = {
  id: "sonata-set:24",
  name: "Pact of Neonlight Leap",
  pieceBonuses: [
    {
      pieces: 2,
      effectDescription: "Spectro DMG +10%.",
      effects: [staticElementalBonus("sonata-set:24", "Pact of Neonlight Leap", "spectro", 10)],
    },
    {
      pieces: 5,
      effectDescription:
        "Outro grants the incoming Resonator an ATK bonus that scales with that incoming Resonator's Tune Break Boost, lasting 15s or until switch-out.",
    },
  ],
  source: preciseSonataSource,
};

const haloOfStarryRadiance: Sonata = {
  id: "sonata-set:25",
  name: "Halo of Starry Radiance",
  pieceBonuses: [
    {
      pieces: 2,
      effectDescription: "Healing Bonus +10%.",
      effects: [staticHealingBonus("sonata-set:25", "Halo of Starry Radiance", 10)],
    },
    {
      pieces: 5,
      effectDescription:
        "Healing grants team ATK for 4s based on Off-Tune Buildup Rate, capped at 25%; effects of the same name do not stack.",
    },
  ],
  source: preciseSonataSource,
};

const chromaticFoam: Sonata = {
  id: "sonata-set:28",
  name: "Chromatic Foam",
  pieceBonuses: [
    {
      pieces: 2,
      effectDescription: "Fusion DMG +10%.",
      effects: [staticElementalBonus("sonata-set:28", "Chromatic Foam", "fusion", 10)],
    },
    {
      pieces: 5,
      effectDescription:
        "Inflicting Fusion Burst grants the wearer +10% Fusion DMG for 15s; while active, Outro grants the incoming Resonator +25% Fusion DMG for 15s.",
      effects: [chromaticFoamPersonal],
    },
  ],
  source: preciseSonataSource,
};

const soundOfTrueName: Sonata = {
  id: "sonata-set:29",
  name: "Sound of True Name",
  pieceBonuses: [
    {
      pieces: 2,
      effectDescription: "Aero DMG +10%.",
      effects: [staticElementalBonus("sonata-set:29", "Sound of True Name", "aero", 10)],
    },
    {
      pieces: 5,
      effectDescription:
        "Dealing Echo Skill DMG increases Echo Skill Crit Rate by 20% and grants 15% Aero DMG Bonus for 5s.",
    },
  ],
  source: preciseSonataSource,
};

const wishesOfQuietSnowfall: Sonata = {
  id: "sonata-set:30",
  name: "Wishes of Quiet Snowfall",
  pieceBonuses: [
    {
      pieces: 2,
      effectDescription: "Glacio DMG +10%.",
      effects: [staticElementalBonus("sonata-set:30", "Wishes of Quiet Snowfall", "glacio", 10)],
    },
    {
      pieces: 5,
      effectDescription:
        "Inflicting Glacio Chafe starts the Snowfall branch: personal Glacio/Resonance Liberation Crit behavior or an outgoing Outro Glacio bonus depending on how Snowfall is consumed.",
    },
  ],
  source: preciseSonataSource,
};

const reelOfSplicedMemories: Sonata = {
  id: "sonata-set:31",
  name: "Reel of Spliced Memories",
  pieceBonuses: [
    {
      pieces: 2,
      effectDescription: "ATK +10%.",
      effects: [staticAttackPercent("sonata-set:31", "Reel of Spliced Memories", 10)],
    },
    {
      pieces: 5,
      effectDescription:
        "Inflicting Tune Rupture - Shifting or Tune Strain - Shifting grants the team +20 Tune Break Boost for 30s; same-name effects do not stack.",
    },
  ],
  source: preciseSonataSource,
};

const celestialLight: Sonata = {
  id: "sonata-set:5",
  name: "Celestial Light",
  pieceBonuses: [
    {
      pieces: 2,
      effectDescription: "Spectro DMG +10%.",
      effects: [staticElementalBonus("sonata-set:5", "Celestial Light", "spectro", 10)],
    },
    {
      pieces: 5,
      effectDescription: "Releasing Intro Skill grants +30% Spectro DMG for 15s.",
      effects: [celestialLightIntro],
    },
  ],
  source: preciseSonataSource,
};

const rejuvenatingGlow: Sonata = {
  id: "sonata-set:7",
  name: "Rejuvenating Glow",
  pieceBonuses: [
    {
      pieces: 2,
      effectDescription: "Healing Bonus +10%.",
      effects: [staticHealingBonus("sonata-set:7", "Rejuvenating Glow", 10)],
    },
    {
      pieces: 5,
      effectDescription: "Healing allies increases all party members' ATK by 15% for 30s.",
      effects: [rejuvenatingGlowPersonal],
    },
  ],
  source: preciseSonataSource,
};

export const preciseModernSonatas: readonly Sonata[] = [
  celestialLight,
  rejuvenatingGlow,
  midnightVeil,
  dreamOfTheLost,
  crownOfValor,
  lawOfHarmony,
  flamewingsShadow,
  pactOfNeonlightLeap,
  haloOfStarryRadiance,
  chromaticFoam,
  soundOfTrueName,
  wishesOfQuietSnowfall,
  reelOfSplicedMemories,
];

export const preciseSonataTierCoverage: readonly PreciseSonataTierCoverage[] = [
  { sonataSetId: "sonata-set:5", pieces: 2, coverage: "personal-complete", note: "Static Spectro bonus is executable." },
  { sonataSetId: "sonata-set:5", pieces: 5, coverage: "personal-complete", note: "Intro-gated Spectro window is executable only when the scenario emits Intro." },
  { sonataSetId: "sonata-set:7", pieces: 2, coverage: "personal-complete", note: "Static Healing Bonus is executable." },
  { sonataSetId: "sonata-set:7", pieces: 5, coverage: "personal-complete", note: "Personal share of the heal-triggered party ATK buff is executable from heal-applied events." },
  { sonataSetId: "sonata-set:12", pieces: 2, coverage: "personal-complete", note: "Static Havoc bonus is executable." },
  { sonataSetId: "sonata-set:12", pieces: 5, coverage: "personal-partial", note: "Outro damage and incoming-resonator ownership require explicit scenario/runtime wiring." },
  { sonataSetId: "sonata-set:19", pieces: 3, coverage: "pending-runtime-context", note: "Requires a canonical Resonance Energy semantic binding; never preactivate it." },
  { sonataSetId: "sonata-set:20", pieces: 3, coverage: "personal-complete", note: "Shield-gained stacks are executable." },
  { sonataSetId: "sonata-set:21", pieces: 3, coverage: "personal-partial", note: "Caster Heavy Attack window is executable; the team Echo Skill stack component remains separate." },
  { sonataSetId: "sonata-set:22", pieces: 3, coverage: "personal-partial", note: "Both Crit windows are executable; the +16% Fusion conjunction must not outlive either source window and remains pending." },
  { sonataSetId: "sonata-set:24", pieces: 2, coverage: "personal-complete", note: "Static Spectro bonus is executable." },
  { sonataSetId: "sonata-set:24", pieces: 5, coverage: "team-owned", note: "Buff belongs to the incoming Resonator." },
  { sonataSetId: "sonata-set:25", pieces: 2, coverage: "personal-complete", note: "Static Healing Bonus is executable." },
  { sonataSetId: "sonata-set:25", pieces: 5, coverage: "pending-runtime-context", note: "Needs exact Off-Tune Buildup Rate runtime stat semantics before computing the caster's share." },
  { sonataSetId: "sonata-set:28", pieces: 2, coverage: "personal-complete", note: "Static Fusion bonus is executable." },
  { sonataSetId: "sonata-set:28", pieces: 5, coverage: "personal-complete", note: "Wearer's Fusion Burst window is executable; outgoing Outro bonus is Team-DPS-owned." },
  { sonataSetId: "sonata-set:29", pieces: 2, coverage: "personal-complete", note: "Static Aero bonus is executable." },
  { sonataSetId: "sonata-set:29", pieces: 5, coverage: "pending-runtime-context", note: "Not required by the current 3+2 reference builds; retain exact trigger data before promotion." },
  { sonataSetId: "sonata-set:30", pieces: 2, coverage: "personal-complete", note: "Static Glacio bonus is executable." },
  { sonataSetId: "sonata-set:30", pieces: 5, coverage: "pending-runtime-context", note: "Snowfall / Glacio Chafe consumption needs exact status events before execution." },
  { sonataSetId: "sonata-set:31", pieces: 2, coverage: "personal-complete", note: "Static ATK bonus is executable." },
  { sonataSetId: "sonata-set:31", pieces: 5, coverage: "pending-runtime-context", note: "Requires exact Shifting event ownership before applying team Tune Break Boost, including the wearer's share." },
];

export function getPreciseSonataTierCoverage(
  sonataSetId: string,
  pieces: SonataPieceBonus["pieces"],
): PreciseSonataTierCoverage | undefined {
  return preciseSonataTierCoverage.find(
    (entry) => entry.sonataSetId === sonataSetId && entry.pieces === pieces,
  );
}
