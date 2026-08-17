import assert from "node:assert/strict";
import { projectEchoCatalogV1 } from "./lib/echo-catalog-projection.mjs";

function sourceFixture() {
  return {
    manifest: {
      schemaVersion: 1,
      counts: { characters: 60, weapons: 120, echoes: 1, sonataSets: 1 },
    },
    characters: [{ dangerous: "not projected" }],
    weapons: [{ dangerous: "not projected" }],
    echoes: [
      {
        kind: "echo",
        id: "echo:1001",
        name: "Crownless",
        cost: 4,
        sonataSetIds: ["sonata:2001"],
        echoSkill: {
          description: "<script>must remain inert and excluded</script>",
          sourceParameters: { formula: "never expose this through the UI projection" },
        },
        source: { externalUrl: "https://example.invalid/untrusted" },
      },
    ],
    sonataSets: [
      {
        kind: "sonata-set",
        id: "sonata:2001",
        name: "Sun-sinking Eclipse",
        bonuses: [{ pieces: 5, description: "untrusted source prose" }],
      },
    ],
  };
}

const projection = projectEchoCatalogV1(sourceFixture());
assert.deepEqual(projection, {
  schemaVersion: 1,
  echoes: [
    {
      id: "echo:1001",
      name: "Crownless",
      cost: 4,
      sonataSetIds: ["sonata:2001"],
    },
  ],
  sonataSets: [{ id: "sonata:2001", name: "Sun-sinking Eclipse" }],
});

const serialized = JSON.stringify(projection);
assert.equal(serialized.includes("script"), false);
assert.equal(serialized.includes("externalUrl"), false);
assert.equal(serialized.includes("sourceParameters"), false);
assert.equal(serialized.includes("untrusted source prose"), false);

{
  const source = sourceFixture();
  source.echoes[0].sonataSetIds = ["sonata:missing"];
  assert.throws(() => projectEchoCatalogV1(source), /unknown Sonata/);
}

{
  const source = sourceFixture();
  source.echoes.push({ ...source.echoes[0] });
  source.manifest.counts.echoes = 2;
  assert.throws(() => projectEchoCatalogV1(source), /duplicate Echo id/);
}

{
  const source = sourceFixture();
  source.echoes[0].cost = 2;
  assert.throws(() => projectEchoCatalogV1(source), /must be 1, 3, or 4/);
}

{
  const source = sourceFixture();
  source.manifest.counts.echoes = 178;
  assert.throws(() => projectEchoCatalogV1(source), /manifest counts/);
}

{
  const source = sourceFixture();
  source.echoes[0].name = "Bad\u0000Name";
  assert.throws(() => projectEchoCatalogV1(source), /bounded printable string/);
}

{
  const source = sourceFixture();
  source.echoes[0].sonataSetIds = Array.from({ length: 17 }, (_, index) => `sonata:${index}`);
  assert.throws(() => projectEchoCatalogV1(source), /between 1 and 16 ids/);
}

console.log("Echo catalog projection security tests passed.");
