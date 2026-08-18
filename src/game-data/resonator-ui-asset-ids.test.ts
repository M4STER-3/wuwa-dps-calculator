import { describe, expect, it } from "vitest";

import { resonators } from "../data/catalog";
import {
  getResonatorUiPortraitPath,
  promotedResonatorUiAssetIds,
  requireResonatorUiAssetId,
} from "./resonator-ui-asset-ids";

describe("promoted Resonator UI asset IDs", () => {
  it("keeps the reviewed roster crosswalk stable", () => {
    expect(promotedResonatorUiAssetIds).toEqual({
      aemeath: "1210",
      augusta: "1306",
      brant: "1206",
      calcharo: "1301",
      cantarella: "1607",
      carlotta: "1107",
      cartethyia: "1409",
      changli: "1205",
      chisa: "1508",
      ciaccona: "1407",
      verina: "1503",
    });
  });

  it("uses unique numeric Wuwa IDs and excludes Camellya", () => {
    const values = Object.values(promotedResonatorUiAssetIds);
    expect(values.every((value) => /^\d+$/.test(value))).toBe(true);
    expect(new Set(values).size).toBe(values.length);
    expect(promotedResonatorUiAssetIds).not.toHaveProperty("camellya");
  });

  it("keeps direct portrait paths only for the legacy reviewed trio", () => {
    expect(getResonatorUiPortraitPath("aemeath")).toMatch(/^\/assets\/wuwa\/objects\//);
    expect(getResonatorUiPortraitPath("chisa")).toMatch(/^\/assets\/wuwa\/objects\//);
    expect(getResonatorUiPortraitPath("verina")).toMatch(/^\/assets\/wuwa\/objects\//);
    expect(getResonatorUiPortraitPath("augusta")).toBeUndefined();
  });

  it("covers every real Resonator promoted into the functional catalogue", () => {
    const promotedIds = resonators
      .filter((resonator) => resonator.source.kind !== "technical-fixture")
      .map((resonator) => resonator.id);

    expect(() => promotedIds.forEach(requireResonatorUiAssetId)).not.toThrow();
  });

  it("fails closed when a promoted Resonator has no verified asset ID", () => {
    expect(() => requireResonatorUiAssetId("unknown-resonator")).toThrow(
      "Missing verified Wuwa UI asset ID",
    );
  });
});
