type ResonatorUiAsset = {
  readonly assetId: string;
  /** Reviewed direct local portrait path used by the Character Box when available. */
  readonly portraitPath?: `/assets/wuwa/objects/${string}`;
};

const PROMOTED_RESONATOR_UI_ASSETS = {
  aemeath: {
    assetId: "1210",
    portraitPath:
      "/assets/wuwa/objects/e3daf909b043ab2f6ffa706967a910f50133900dd00dddd94faac9d51a1b55eb.webp",
  },
  augusta: { assetId: "1306" },
  brant: { assetId: "1206" },
  calcharo: { assetId: "1301" },
  cantarella: { assetId: "1607" },
  carlotta: { assetId: "1107" },
  cartethyia: { assetId: "1409" },
  changli: { assetId: "1205" },
  chisa: {
    assetId: "1508",
    portraitPath:
      "/assets/wuwa/objects/032c01884fc173aa401462b0a45e341bb441609c8fc497ddcd34117460b2185d.webp",
  },
  ciaccona: { assetId: "1407" },
  verina: {
    assetId: "1503",
    portraitPath:
      "/assets/wuwa/objects/b05014748673f03cf6627f79456e67204fae5dd745ec7f47da75b7cd2451d7e3.webp",
  },
  phrolova: {
    assetId: "1608",
    portraitPath:
      "/assets/wuwa/objects/0d03bc538c8974815b6b292f818d6865e7b67ab06019f6f64cb1ebffa3a74491.webp",
  },
  denia: {
    assetId: "1211",
    portraitPath:
      "/assets/wuwa/objects/81de50dcc0ee6b16a0ded1c35e7bbbf948c9c15aa77e279b7f33dd143c3a4e40.webp",
  },
  lynae: {
    assetId: "1509",
    portraitPath:
      "/assets/wuwa/objects/474e5298831a41861c4ee2271cd4c72d534207b93ac4ebff2791bbe0093718b8.webp",
  },
  mornye: {
    assetId: "1209",
    portraitPath:
      "/assets/wuwa/objects/9decc9852973dc496da01d1171e4fb566cd832489df5c13649d38079cde21d41.webp",
  },
  qiuyuan: {
    assetId: "1411",
    portraitPath:
      "/assets/wuwa/objects/2961f0581bb75d81df313093ddc73ce87340e115cb616bc96eac59f1d074cf86.webp",
  },
  jinhsi: {
    assetId: "1304",
    portraitPath:
      "/assets/wuwa/objects/228cc64e2cc9b7f09bb72b53b9011e93e81b25ce05cd793114ecb6039653a001.webp",
  },
  galbrena: {
    assetId: "1208",
    portraitPath:
      "/assets/wuwa/objects/88fd2277453ab90a547cf3d27ba6abb6c2bdeb8a8e3a56be94cd59b5a139c0ef.webp",
  },
  iuno: {
    assetId: "1410",
    portraitPath:
      "/assets/wuwa/objects/4284340a2edd3609f37aeb03d1c737a9b39f61a101eb2ba89b0c078630f1c4c4.webp",
  },
  shorekeeper: {
    assetId: "1505",
    portraitPath:
      "/assets/wuwa/objects/717bb5c5797814eca87d86214f03f3724661fbc74b9d8c49e910dc63ec45d459.webp",
  },
  hiyuki: {
    assetId: "1108",
    portraitPath:
      "/assets/wuwa/objects/b35bf760ffe4f3a6573f6538bc6a7dc4ec542618d542d8bf48824f68db2c86ea.webp",
  },
} as const satisfies Record<string, ResonatorUiAsset>;

export function getResonatorUiAssetId(resonatorId: string): string | undefined {
  return (PROMOTED_RESONATOR_UI_ASSETS as Record<string, ResonatorUiAsset>)[
    resonatorId
  ]?.assetId;
}

export function requireResonatorUiAssetId(resonatorId: string): string {
  const assetId = getResonatorUiAssetId(resonatorId);
  if (!assetId) {
    throw new Error(
      `Missing verified Wuwa UI asset ID for promoted Resonator: ${resonatorId}`,
    );
  }
  return assetId;
}

export function getResonatorUiPortraitPath(
  resonatorId: string,
): `/assets/wuwa/objects/${string}` | undefined {
  return (PROMOTED_RESONATOR_UI_ASSETS as Record<string, ResonatorUiAsset>)[
    resonatorId
  ]?.portraitPath;
}

export function requireResonatorUiPortraitPath(
  resonatorId: string,
): `/assets/wuwa/objects/${string}` {
  const portraitPath = getResonatorUiPortraitPath(resonatorId);
  if (!portraitPath) {
    throw new Error(
      `Missing verified Wuwa UI portrait path for promoted Resonator: ${resonatorId}`,
    );
  }
  return portraitPath;
}

export const promotedResonatorUiAssetIds = Object.freeze(
  Object.fromEntries(
    Object.entries(PROMOTED_RESONATOR_UI_ASSETS).map(([id, asset]) => [
      id,
      asset.assetId,
    ]),
  ),
) as Readonly<Record<string, string>>;

export const promotedResonatorUiAssets = PROMOTED_RESONATOR_UI_ASSETS;
