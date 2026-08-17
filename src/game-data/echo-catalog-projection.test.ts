import { describe, expect, it } from "vitest";
import { projectEchoCatalogV1 } from "./echo-catalog-projection";

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

describe("projectEchoCatalogV1", () => {
  it("keeps only the bounded UI fields needed by the Echo editor", () => {
    const projection = projectEchoCatalogV1(sourceFixture());

    expect(projection).toEqual({
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
    expect(JSON.stringify(projection)).not.toContain("script");
    expect(JSON.stringify(projection)).not.toContain("externalUrl");
    expect(JSON.stringify(projection)).not.toContain("sourceParameters");
  });

  it("rejects references to an unknown Sonata set", () => {
    const source = sourceFixture();
    source.echoes[0]!.sonataSetIds = ["sonata:missing"];
    expect(() => projectEchoCatalogV1(source)).toThrow(/unknown Sonata/);
  });

  it("rejects duplicate Echo identities", () => {
    const source = sourceFixture();
    source.echoes.push({ ...source.echoes[0]! });
    source.manifest.counts.echoes = 2;
    expect(() => projectEchoCatalogV1(source)).toThrow(/duplicate Echo id/);
  });

  it("rejects unsupported costs instead of guessing", () => {
    const source = sourceFixture();
    source.echoes[0]!.cost = 2;
    expect(() => projectEchoCatalogV1(source)).toThrow(/must be 1, 3, or 4/);
  });

  it("rejects manifest count mismatches", () => {
    const source = sourceFixture();
    source.manifest.counts.echoes = 178;
    expect(() => projectEchoCatalogV1(source)).toThrow(/manifest counts/);
  });

  it("rejects control characters in display strings", () => {
    const source = sourceFixture();
    source.echoes[0]!.name = "Bad\u0000Name";
    expect(() => projectEchoCatalogV1(source)).toThrow(/bounded printable string/);
  });
});
