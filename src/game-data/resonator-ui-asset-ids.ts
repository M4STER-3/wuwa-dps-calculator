const PROMOTED_RESONATOR_UI_ASSETS = {
  aemeath: {
    assetId: "1210",
    portraitPath:
      "/assets/wuwa/objects/e3daf909b043ab2f6ffa706967a910f50133900dd00dddd94faac9d51a1b55eb.webp",
  },
  chisa: {
    assetId: "1508",
    portraitPath:
      "/assets/wuwa/objects/032c01884fc173aa401462b0a45e341bb441609c8fc497ddcd34117460b2185d.webp",
  },
  verina: {
    assetId: "1503",
    portraitPath:
      "/assets/wuwa/objects/b05014748673f03cf6627f79456e67204fae5dd745ec7f47da75b7cd2451d7e3.webp",
  },
} as const satisfies Record<
  string,
  { readonly assetId: string; readonly portraitPath: `/assets/wuwa/objects/${string}` }
>;

export function getResonatorUiAssetId(resonatorId: string): string | undefined {
  return (PROMOTED_RESONATOR_UI_ASSETS as Record<string, { assetId: string }>)[
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
  return (
    PROMOTED_RESONATOR_UI_ASSETS as Record<
      string,
      { portraitPath: `/assets/wuwa/objects/${string}` }
    >
  )[resonatorId]?.portraitPath;
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
