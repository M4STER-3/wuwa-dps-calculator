import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const databasePath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const outputPath = path.resolve(root, "src/generated/precise-character-box-echo-presets.ts");
const temporaryPath = `${outputPath}.${process.pid}.tmp`;

const recipes = [
  { key: "phrolova", resonatorId: "phrolova", characterName: "Phrolova", mainEcho: "Nightmare: Hecate", sets: [["Dream of the Lost", 3], ["Midnight Veil", 2]], style: "dps", damageSubstat: "echo-sub-resonance-skill-damage" },
  { key: "denia-fusion-burst", resonatorId: "denia", characterName: "Denia", variant: "Fusion Burst", mainEcho: "Reminiscence: Denia", sets: [["Chromatic Foam", 5]], style: "dps", damageSubstat: "echo-sub-resonance-liberation-damage" },
  { key: "denia-tune-strain", resonatorId: "denia", characterName: "Denia", variant: "Tune Strain", mainEcho: "Voidwing Moth", sets: [["Reel of Spliced Memories", 5]], style: "dps", damageSubstat: "echo-sub-resonance-skill-damage" },
  { key: "lynae", resonatorId: "lynae", characterName: "Lynae", mainEcho: "Hyvatia", sets: [["Pact of Neonlight Leap", 5]], style: "dps", damageSubstat: "echo-sub-basic-attack-damage" },
  { key: "mornye", resonatorId: "mornye", characterName: "Mornye", mainEcho: "Reactor Husk", sets: [["Halo of Starry Radiance", 5]], style: "def-support", damageSubstat: "echo-sub-resonance-liberation-damage" },
  { key: "qiuyuan", resonatorId: "qiuyuan", characterName: "Qiuyuan", mainEcho: "Reminiscence: Fenrico", sets: [["Law of Harmony", 3], ["Sound of True Name", 2]], style: "dps", damageSubstat: "echo-sub-heavy-attack-damage" },
  { key: "jinhsi", resonatorId: "jinhsi", characterName: "Jinhsi", mainEcho: "Jué", sets: [["Celestial Light", 5]], style: "dps", damageSubstat: "echo-sub-resonance-skill-damage" },
  { key: "galbrena", resonatorId: "galbrena", characterName: "Galbrena", mainEcho: "Corrosaurus", sets: [["Flamewing's Shadow", 3], ["Chromatic Foam", 2]], style: "dps", damageSubstat: "echo-sub-heavy-attack-damage" },
  { key: "iuno", resonatorId: "iuno", characterName: "Iuno", mainEcho: "Lady of the Sea", sets: [["Crown of Valor", 3], ["Sound of True Name", 2]], style: "dps", damageSubstat: "echo-sub-resonance-liberation-damage" },
  { key: "shorekeeper", resonatorId: "shorekeeper", characterName: "Shorekeeper", mainEcho: "Fallacy of No Return", sets: [["Rejuvenating Glow", 5]], style: "hp-support", damageSubstat: "echo-sub-resonance-liberation-damage" },
  { key: "hiyuki", resonatorId: "hiyuki", characterName: "Hiyuki", mainEcho: "Reminiscence: Threnodian - Voidborne Construct", sets: [["Wishes of Quiet Snowfall", 5]], style: "dps", damageSubstat: "echo-sub-resonance-liberation-damage" },
];

const normalize = (value) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
const database = JSON.parse(await readFile(databasePath, "utf8"));
const exactByName = (entries, name, label) => {
  const matches = entries.filter((entry) => normalize(entry.name) === normalize(name));
  if (matches.length !== 1) throw new Error(`${label} ${name} resolves to ${matches.length} entries`);
  return matches[0];
};
const sonataByName = new Map(database.sonataSets.map((entry) => [normalize(entry.name), entry]));
const echoByName = new Map(database.echoes.map((entry) => [normalize(entry.name), entry]));

const permutations = (values) => {
  if (values.length <= 1) return [values];
  const result = [];
  const seen = new Set();
  values.forEach((value, index) => {
    if (seen.has(value)) return;
    seen.add(value);
    for (const tail of permutations([...values.slice(0, index), ...values.slice(index + 1)])) result.push([value, ...tail]);
  });
  return result;
};

function costPlans(mainCost) {
  const patterns = [];
  for (const a of [4, 3, 1]) for (const b of [4, 3, 1]) for (const c of [4, 3, 1]) for (const d of [4, 3, 1]) {
    const costs = [a, b, c, d];
    const total = mainCost + costs.reduce((sum, value) => sum + value, 0);
    if (total <= 12) patterns.push(costs);
  }
  const score = (costs) => {
    const all = [mainCost, ...costs].sort((a, b) => b - a).join("");
    const standard = all === "43311" ? 1000 : all === "44111" ? 800 : 0;
    return standard + mainCost + costs.reduce((sum, value) => sum + value, 0);
  };
  return patterns.sort((left, right) => score(right) - score(left));
}

function chooseEchoes(recipe, setEntries, mainEcho) {
  const mainSet = setEntries.find(([set, count]) => count > 0 && mainEcho.sonataSetIds.includes(set.id));
  if (!mainSet) throw new Error(`${recipe.key}: main Echo ${mainEcho.name} is incompatible with requested Sonata sets`);
  const remainingSlots = [];
  let removedMain = false;
  for (const [set, count] of setEntries) {
    for (let index = 0; index < count; index += 1) {
      if (!removedMain && set.id === mainSet[0].id) { removedMain = true; continue; }
      remainingSlots.push(set);
    }
  }
  if (remainingSlots.length !== 4) throw new Error(`${recipe.key}: recipe must resolve to five Echoes`);

  for (const plan of costPlans(mainEcho.cost)) {
    for (const assignedCosts of permutations(plan)) {
      const used = new Set([mainEcho.id]);
      const selected = [];
      let valid = true;
      for (let index = 0; index < remainingSlots.length; index += 1) {
        const set = remainingSlots[index];
        const cost = assignedCosts[index];
        const candidate = database.echoes
          .filter((echo) => echo.cost === cost && echo.sonataSetIds.includes(set.id) && !used.has(echo.id))
          .sort((a, b) => a.id.localeCompare(b.id))[0];
        if (!candidate) { valid = false; break; }
        used.add(candidate.id);
        selected.push([candidate, set]);
      }
      if (valid) return [[mainEcho, mainSet[0]], ...selected];
    }
  }
  throw new Error(`${recipe.key}: no legal <=12-cost five-Echo combination found`);
}

function mainStatId(style, cost, element) {
  if (style === "hp-support") {
    if (cost === 4) return "echo-main-4-crit-damage";
    if (cost === 3) return "echo-main-3-energy-regen";
    return "echo-main-1-hp-percent";
  }
  if (style === "def-support") {
    if (cost === 4) return "echo-main-4-healing-bonus";
    if (cost === 3) return "echo-main-3-defense-percent";
    return "echo-main-1-defense-percent";
  }
  if (cost === 4) return "echo-main-4-crit-damage";
  if (cost === 3) return `echo-main-3-${String(element).toLowerCase()}-damage`;
  return "echo-main-1-attack-percent";
}

function substats(recipe) {
  if (recipe.style === "hp-support") return [
    { statId: "echo-sub-energy-regen", value: 9.2 },
    { statId: "echo-sub-crit-damage", value: 16.2 },
    { statId: "echo-sub-hp-percent", value: 8.6 },
    { statId: "echo-sub-crit-rate", value: 8.1 },
    { statId: recipe.damageSubstat, value: 8.6 },
  ];
  if (recipe.style === "def-support") return [
    { statId: "echo-sub-defense-percent", value: 10.9 },
    { statId: "echo-sub-energy-regen", value: 9.2 },
    { statId: "echo-sub-crit-rate", value: 8.1 },
    { statId: "echo-sub-crit-damage", value: 16.2 },
    { statId: recipe.damageSubstat, value: 8.6 },
  ];
  return [
    { statId: "echo-sub-crit-rate", value: 8.1 },
    { statId: "echo-sub-crit-damage", value: 16.2 },
    { statId: "echo-sub-attack-percent", value: 8.6 },
    { statId: "echo-sub-attack-flat", value: 50 },
    { statId: recipe.damageSubstat, value: 8.6 },
  ];
}

const output = {};
for (const recipe of recipes) {
  const character = exactByName(database.characters, recipe.characterName, `${recipe.key} character`);
  const setEntries = recipe.sets.map(([name, count]) => {
    const set = sonataByName.get(normalize(name));
    if (!set) throw new Error(`${recipe.key}: missing Sonata ${name}`);
    return [set, count];
  });
  const mainEcho = echoByName.get(normalize(recipe.mainEcho));
  if (!mainEcho) throw new Error(`${recipe.key}: missing Main Echo ${recipe.mainEcho}`);
  const chosen = chooseEchoes(recipe, setEntries, mainEcho);
  const echoes = chosen.map(([echo, set]) => ({
    echoId: echo.id,
    sonataSetId: set.id,
    rarity: 5,
    level: 25,
    primaryMainStatId: mainStatId(recipe.style, echo.cost, character.element),
    substats: substats(recipe),
  }));
  const totalCost = chosen.reduce((sum, [echo]) => sum + echo.cost, 0);
  output[recipe.key] = {
    resonatorId: recipe.resonatorId,
    ...(recipe.variant ? { variant: recipe.variant } : {}),
    mainEchoName: mainEcho.name,
    mainEchoCanonicalId: mainEcho.id,
    sonataSetIds: Object.fromEntries(setEntries.map(([set, count]) => [set.id, count])),
    totalCost,
    echoLoadout: { echoes, mainEchoId: mainEcho.id },
  };
}

await mkdir(path.dirname(outputPath), { recursive: true });
const serialized = `/* Generated from WUWA GameDatabase V1. Do not edit manually. */\nexport const generatedPreciseCharacterBoxEchoPresets = ${JSON.stringify(output, null, 2)} as const;\n`;
try {
  await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
  await rename(temporaryPath, outputPath);
} catch (error) {
  await rm(temporaryPath, { force: true }).catch(() => undefined);
  throw error;
}
console.log(`Generated ${path.relative(root, outputPath)} with ${Object.keys(output).length} precise Echo loadouts.`);
