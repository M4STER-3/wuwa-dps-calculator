import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const database = JSON.parse(
  await readFile(path.join(root, "public/data/wuwa/game-database-v1.json"), "utf8"),
);

const reviewed = [
  ["1210", "21020076", "Everbright Polestar"],
  ["1306", "21010026", "Thunderflare Dominion"],
  ["1206", "21020026", "Unflickering Valor"],
  ["1301", "21010015", "Lustrous Razor"],
  ["1607", "21050056", "Whispers of Sirens"],
  ["1107", "21030016", "The Last Dance"],
  ["1409", "21020036", "Defier's Thorn"],
  ["1205", "21020016", "Blazing Brilliance"],
  ["1508", "21010056", "Kumokiri"],
  ["1407", "21030036", "Woodland Aria"],
];

const characterByWuwaId = new Map(
  database.characters.map((entry) => [entry.externalIds?.wuwa, entry]),
);
const weaponByWuwaId = new Map(
  database.weapons.map((entry) => [entry.externalIds?.wuwa, entry]),
);

for (const [characterId, reviewedWeaponId, reviewedWeaponName] of reviewed) {
  const character = characterByWuwaId.get(characterId);
  const weaponAtReviewedId = weaponByWuwaId.get(reviewedWeaponId);
  const nameMatches = database.weapons.filter(
    (entry) => entry.name === reviewedWeaponName,
  );
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
      reviewedWeapon: {
        expectedName: reviewedWeaponName,
        reviewedId: reviewedWeaponId,
        observedAtReviewedId: weaponAtReviewedId
          ? {
              name: weaponAtReviewedId.name,
              type: weaponAtReviewedId.type,
              rarity: weaponAtReviewedId.rarity,
            }
          : null,
        exactNameMatches: nameMatches.map((entry) => ({
          id: entry.externalIds?.wuwa,
          name: entry.name,
          type: entry.type,
          rarity: entry.rarity,
        })),
      },
    }),
  );
}
