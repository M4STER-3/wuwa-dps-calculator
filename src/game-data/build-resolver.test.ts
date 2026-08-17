import { describe, expect, it } from "vitest";
import type { CharacterCatalogEntry, EchoCatalogEntry, GameDatabaseV1, NumericStatProgression, SonataSetCatalogEntry, WeaponCatalogEntry } from "./schema";
import type { EchoLoadoutV1 } from "./echo-loadout";
import { resolveExactBuildStatSheetV1 } from "./build-resolver";

const src = { provider: "encore" as const, externalId: "1", language: "en", dataset: "Release" as const, importedAt: "2026-08-17T00:00:00.000Z", sourceHash: "a".repeat(64) };
const prog = (points: NumericStatProgression["points"]): NumericStatProgression => ({ points, interpolation: "none" });
const character: CharacterCatalogEntry = { kind: "character", id: "character:1", externalIds: { encore: "1" }, name: "Fixture", source: src, rarity: 5, element: "fusion", weaponType: "sword", stats: { hp: prog([{ level: 90, value: 10000 }]), attack: prog([{ level: 90, value: 400 }]), defense: prog([{ level: 90, value: 1000 }]) }, skills: [], sequences: [] };
const weapon: WeaponCatalogEntry = { kind: "weapon", id: "weapon:1", externalIds: { encore: "1" }, name: "Sword", source: src, type: "sword", rarity: 5, baseStats: { attack: prog([{ level: 90, value: 600 }]), secondaryStat: { stat: "ATK", unit: "percentage-points", progression: prog([{ level: 90, value: 36.45 }]) } }, passive: { name: "Passive", ranks: [] } };
const sonata: SonataSetCatalogEntry = { kind: "sonata-set", id: "sonata-set:1", externalIds: { encore: "1" }, name: "Sonata", source: src, bonuses: [{ pieces: 2, description: "Two-piece." }, { pieces: 5, description: "Five-piece." }] };
const echo = (id: string, cost: 1 | 3 | 4): EchoCatalogEntry => ({ kind: "echo", id, externalIds: { encore: id }, name: id, source: { ...src, externalId: id }, cost, sonataSetIds: [sonata.id] });
const db: Pick<GameDatabaseV1, "characters" | "weapons" | "echoes" | "sonataSets"> = { characters: [character], weapons: [weapon], echoes: [echo("e4", 4), echo("e31", 3), echo("e32", 3), echo("e11", 1), echo("e12", 1)], sonataSets: [sonata] };
const loadout: EchoLoadoutV1 = { mainEchoId: "e4", echoes: [
  { echoId: "e4", sonataSetId: sonata.id, rarity: 5, level: 25, primaryMainStatId: "echo-main-4-crit-rate", substats: [{ statId: "echo-sub-crit-damage", value: 21 }, { statId: "echo-sub-attack-percent", value: 11.6 }] },
  { echoId: "e31", sonataSetId: sonata.id, rarity: 5, level: 25, primaryMainStatId: "echo-main-3-fusion-damage", substats: [{ statId: "echo-sub-crit-rate", value: 10.5 }] },
  { echoId: "e32", sonataSetId: sonata.id, rarity: 5, level: 25, primaryMainStatId: "echo-main-3-attack-percent", substats: [{ statId: "echo-sub-energy-regen", value: 12.4 }] },
  { echoId: "e11", sonataSetId: sonata.id, rarity: 5, level: 25, primaryMainStatId: "echo-main-1-attack-percent", substats: [{ statId: "echo-sub-attack-flat", value: 60 }] },
  { echoId: "e12", sonataSetId: sonata.id, rarity: 5, level: 25, primaryMainStatId: "echo-main-1-hp-percent", substats: [{ statId: "echo-sub-hp-flat", value: 580 }, { statId: "echo-sub-resonance-skill-damage", value: 11.6 }] },
] };
const input = () => ({ characterId: character.id, characterLevel: 90, weaponId: weapon.id, weaponLevel: 90, echoLoadout: loadout });

describe("resolveExactBuildStatSheetV1", () => {
  it("resolves exact character + weapon + Echo stats once", () => {
    const r = resolveExactBuildStatSheetV1(db, input());
    expect(r.statSheet.hp).toBeCloseTo(17420);
    expect(r.statSheet.attack).toBeCloseTo(2370.5);
    expect(r.statSheet.critRate).toBeCloseTo(37.5);
    expect(r.statSheet.critDamage).toBeCloseTo(171);
    expect(r.statSheet.energyRegen).toBeCloseTo(112.4);
    expect(r.statSheet.elementalDamageBonus.fusion).toBe(30);
    expect(r.statSheet.damageTypeBonus.resonanceSkill).toBeCloseTo(11.6);
    expect(r.complete).toBe(false);
    expect(r.unresolvedPermanentSources.map((x) => x.kind)).toEqual(["character-permanent-nodes", "weapon-passive", "sonata-bonus", "sonata-bonus"]);
  });

  it("fails closed for incompatible weapon or missing exact progression", () => {
    expect(() => resolveExactBuildStatSheetV1({ ...db, weapons: [{ ...weapon, type: "broadblade" }] }, input())).toThrow(/incompatible/);
    expect(() => resolveExactBuildStatSheetV1({ ...db, characters: [{ ...character, stats: undefined }] }, input())).toThrow(/non-interpolated progression/);
  });

  it("requires explicit ascension side when two exact values share a level", () => {
    const capped = { ...character, stats: { hp: prog([{ level: 20, value: 2000, ascended: false }, { level: 20, value: 2400, ascended: true }]), attack: prog([{ level: 20, value: 100, ascended: false }, { level: 20, value: 120, ascended: true }]), defense: prog([{ level: 20, value: 200, ascended: false }, { level: 20, value: 230, ascended: true }]) } };
    expect(() => resolveExactBuildStatSheetV1({ ...db, characters: [capped] }, { ...input(), characterLevel: 20 })).toThrow(/explicit pre\/post ascension choice/);
  });
});
