import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";

type SourceAttribute = { sourceAttributeId?: string; name?: string; values?: unknown };
type Skill = {
  name?: string;
  description?: string;
  sourceParameters?: { sourceSkillId?: string; type?: string; attributes?: SourceAttribute[] };
};
type Character = { name?: string; skills?: Skill[]; sequences?: unknown[] };
type Weapon = { name?: string; description?: string; passiveDescription?: string; effects?: unknown; sourceParameters?: unknown };
type Database = { characters?: Character[]; weapons?: Weapon[] };

const interesting = /(sinflame|purging|afterflame|cooldown|concerto|resonance energy|resonance cost|forte)/i;

describe("temporary Galbrena raw GameDatabase resource probe", () => {
  it("prints exact resource-related skill fields and Lux & Umbra raw data", () => {
    const file = path.join(process.cwd(), "public/data/wuwa/game-database-v1.json");
    const database = JSON.parse(readFileSync(file, "utf8")) as Database;
    const galbrena = database.characters?.find((entry) => entry.name === "Galbrena");
    const weapon = database.weapons?.find((entry) => entry.name === "Lux & Umbra");
    if (!galbrena || !weapon) throw new Error("Galbrena/Lux & Umbra missing from GameDatabase.");
    const skills = (galbrena.skills ?? []).map((skill) => ({
      name: skill.name,
      sourceSkillId: skill.sourceParameters?.sourceSkillId,
      type: skill.sourceParameters?.type,
      description: skill.description,
      attributes: (skill.sourceParameters?.attributes ?? []).filter((attribute) =>
        interesting.test(attribute.name ?? ""),
      ),
    })).filter((skill) => skill.attributes.length || interesting.test(skill.description ?? ""));
    throw new Error(`GALBRENA_RAW=${JSON.stringify({ skills, sequences: galbrena.sequences, weapon })}`);
  });
});
