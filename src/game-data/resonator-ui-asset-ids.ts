const PROMOTED_RESONATOR_UI_ASSET_IDS = {
  aemeath: "1210",
  chisa: "1508",
  verina: "1503",
} as const satisfies Record<string, string>;

export function getResonatorUiAssetId(resonatorId: string): string | undefined {
  return (PROMOTED_RESONATOR_UI_ASSET_IDS as Record<string, string>)[resonatorId];
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

export const promotedResonatorUiAssetIds = PROMOTED_RESONATOR_UI_ASSET_IDS;
