import { describe, expect, it } from "vitest";

import { resonators } from "../data/catalog";
import {
  getResonatorUiPortraitPath,
  promotedResonatorUiAssetIds,
  requireResonatorUiAssetId,
} from "./resonator-ui-asset-ids";

const EXPECTED_IDS = {
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
  phrolova: "1608",
  denia: "1211",
  lynae: "1509",
  mornye: "1209",
  qiuyuan: "1411",
  jinhsi: "1304",
  galbrena: "1208",
  iuno: "1410",
  shorekeeper: "1505",
  hiyuki: "1108",
} as const;

const PRECISE_IDS = [
  "phrolova",
  "denia",
  "lynae",
  "mornye",
  "qiuyuan",
  "jinhsi",
  "galbrena",
  "iuno",
  "shorekeeper",
  "hiyuki",
] as const;

describe("promoted Resonator UI asset IDs", () => {
  it("keeps the reviewed roster crosswalk stable", () => {
    expect(promotedResonatorUiAssetIds).toEqual(EXPECTED_IDS);
  });

  it("uses unique numeric Wuwa IDs and excludes Camellya", () => {
    const values = Object.values(promotedResonatorUiAssetIds);
    expect(values.every((value) => /^\d+$/.test(value))).toBe(true);
    expect(new Set(values).size).toBe(values.length);
    expect(promotedResonatorUiAssetIds).not.toHaveProperty("camellya");
  });

  it("keeps verified direct local portrait paths for precise Character Box promotion", () => {
    expect(getResonatorUiPortraitPath("aemeath")).toMatch(/^\/assets\/wuwa\/objects\//);
    expect(getResonatorUiPortraitPath("chisa")).toMatch(/^\/assets\/wuwa\/objects\//);
    expect(getResonatorUiPortraitPath("verina")).toMatch(/^\/assets\/wuwa\/objects\//);
    for (const id of PRECISE_IDS) {
      expect(getResonatorUiPortraitPath(id), id).toMatch(
        /^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/,
      );
    }
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
