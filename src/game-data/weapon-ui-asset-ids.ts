const PROMOTED_WEAPON_UI_ASSETS = {
  "everbright-polestar": {
    assetId: "21020076",
    iconPath:
      "/assets/wuwa/objects/cb5948fae96eca7de41fa1fe1afced2f133024c060b75a47b37c4b055a96fd7c.webp",
  },
  kumokiri: {
    assetId: "21010056",
    iconPath:
      "/assets/wuwa/objects/b71ad7d5738edb73c2c46e3bed7214bd2608f472f8027d7677244fabcae38ca0.webp",
  },
  variation: {
    assetId: "21050024",
    iconPath:
      "/assets/wuwa/objects/c62c5d410539ab42bfc4cb58180f4c761b205d0da72df410ce478f1aeb203974.webp",
  },
} as const satisfies Record<
  string,
  {
    readonly assetId: string;
    readonly iconPath: `/assets/wuwa/objects/${string}`;
  }
>;

export function getWeaponUiAssetId(weaponId: string): string | undefined {
  return (PROMOTED_WEAPON_UI_ASSETS as Record<string, { assetId: string }>)[weaponId]
    ?.assetId;
}

export function getWeaponUiIconPath(
  weaponId: string,
): `/assets/wuwa/objects/${string}` | undefined {
  return (
    PROMOTED_WEAPON_UI_ASSETS as Record<
      string,
      { iconPath: `/assets/wuwa/objects/${string}` }
    >
  )[weaponId]?.iconPath;
}

export function requireWeaponUiIconPath(
  weaponId: string,
): `/assets/wuwa/objects/${string}` {
  const path = getWeaponUiIconPath(weaponId);
  if (!path) {
    throw new Error(`Missing verified Wuwa UI icon for promoted weapon: ${weaponId}`);
  }
  return path;
}

export const promotedWeaponUiAssets = PROMOTED_WEAPON_UI_ASSETS;
