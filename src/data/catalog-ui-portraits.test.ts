import { describe, expect, it } from "vitest";

import { resonators } from "./catalog";

const isPromoted = (resonator: (typeof resonators)[number]) =>
  resonator.source.kind !== "technical-fixture";

describe("promoted Resonator UI portraits", () => {
  it("routes every promoted Resonator through the same-origin portrait endpoint", () => {
    for (const resonator of resonators.filter(isPromoted)) {
      expect(resonator.portrait).toEqual({
        src: `/api/wuwa/character-portrait/${encodeURIComponent(resonator.id)}`,
        alt: `Portrait de ${resonator.name}`,
      });
    }
  });

  it("never assigns promoted portrait routes to technical fixtures", () => {
    for (const resonator of resonators.filter((entry) => !isPromoted(entry))) {
      expect(resonator.portrait).toBeUndefined();
    }
  });
});
