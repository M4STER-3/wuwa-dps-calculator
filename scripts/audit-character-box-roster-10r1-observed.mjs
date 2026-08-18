import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const database = JSON.parse(
  await readFile(path.join(root, "public/data/wuwa/game-database-v1.json"), "utf8"),
);

const reviewed = [
  ["1210", "21020076"],
  ["1306", "21010026"],
  ["1206", "21020026"],
  ["1301", "21010015"],
  ["1607", "21050056"],
  ["1107", "21030016"],
  ["1409", "21020036"],
  ["1205", "21020016"],
  ["1508", "21010056"],
  ["1407", "21030036"],
];

const characterByWuwaId = new Map(
  database.characters.map((entry) => [entry.externalIds?.wuwa, entry]),
);
const weaponByWuwaId = new Map(
  database.weapons.map((entry) => [entry.externalIds?.wuwa, entry]),
);

for (const [characterId, weaponId] of reviewed) {
  const character = characterByWuwaId.get(characterId);
  const weapon = weaponByWuwaId.get(weaponId);
  console.log(
    JSON.stringify({
      character: character
        ? {
            id: characterId,
            name: character.name,
            element: character.element,
            weaponType: character.weaponType,
            rarity: character.rarity,
          }
        : { id: characterId, missing: true },
      weapon: weapon
        ? {
            id: weaponId,
            name: weapon.name,
            type: weapon.type,
            rarity: weapon.rarity,
          }
        : { id: weaponId, missing: true },
    }),
  );
}
