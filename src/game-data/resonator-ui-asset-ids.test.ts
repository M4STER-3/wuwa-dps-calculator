import { describe, expect, it } from "vitest";
import {
  promotedResonatorUiAssetIds,
  requireResonatorUiAssetId,
} from "./resonator-ui-asset-ids";

describe("promoted Resonator UI asset IDs", () => {
  it("keeps the verified promoted crosswalk stable", () => {
    expect(promotedResonatorUiAssetIds).toEqual({
      aemeath: "1210",
      chisa: "1508",
      verina: "1503",
    });
  });

  it("uses unique numeric Wuwa IDs", () => {
    const values = Object.values(promotedResonatorUiAssetIds);
    expect(values.every((value) => /^\d+$/.test(value))).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });

  it("fails closed when a promoted Resonator has no verified asset ID", () => {
    expect(() => requireResonatorUiAssetId("unknown-resonator")).toThrow(
      "Missing verified Wuwa UI asset ID",
    );
  });
});
