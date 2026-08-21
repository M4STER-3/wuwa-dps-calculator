type WeaponUiAsset = {
  readonly assetId: string;
  /** Reviewed direct local icon path when available. */
  readonly iconPath?: `/assets/wuwa/objects/${string}`;
};

const PROMOTED_WEAPON_UI_ASSETS = {
  "everbright-polestar": {
    assetId: "21020076",
    iconPath:
      "/assets/wuwa/objects/cb5948fae96eca7de41fa1fe1afced2f133024c060b75a47b37c4b055a96fd7c.webp",
  },
  "thunderflare-dominion": { assetId: "21010046" },
  "unflickering-valor": { assetId: "21020036" },
  "lustrous-razor": { assetId: "21010015" },
  "whispers-of-sirens": { assetId: "21050056" },
  "the-last-dance": { assetId: "21030016" },
  "defiers-thorn": { assetId: "21020056" },
  "blazing-brilliance": { assetId: "21020016" },
  kumokiri: {
    assetId: "21010056",
    iconPath:
      "/assets/wuwa/objects/b71ad7d5738edb73c2c46e3bed7214bd2608f472f8027d7677244fabcae38ca0.webp",
  },
  "woodland-aria": { assetId: "21030026" },
  variation: {
    assetId: "21050024",
    iconPath:
      "/assets/wuwa/objects/c62c5d410539ab42bfc4cb58180f4c761b205d0da72df410ce478f1aeb203974.webp",
  },
  "precise-phrolova-signature": {
    assetId: "21050066",
    iconPath:
      "/assets/wuwa/objects/a329c00588a3019b950fbdf1a1c1410b998c8ad3d56af5e9308fc85a02c91fa4.webp",
  },
  "precise-denia-signature": {
    assetId: "21050076",
    iconPath:
      "/assets/wuwa/objects/830935d25509fb807a8f6d33e15977c280574df5f8dbf2010b5c23e0543c29b0.webp",
  },
  "precise-lynae-signature": {
    assetId: "21030046",
    iconPath:
      "/assets/wuwa/objects/4b389f65f60aff259035512d63a4dae5183b5f96343ca8cd62543fe5c49c46c1.webp",
  },
  "precise-mornye-signature": {
    assetId: "21010066",
    iconPath:
      "/assets/wuwa/objects/01c4d902d7b7ab1ec749390548f0a72e1303b039d1a1ba84797935fc010ee614.webp",
  },
  "precise-qiuyuan-signature": {
    assetId: "21020066",
    iconPath:
      "/assets/wuwa/objects/ee4d2cd315dbcdc5e7be0867938b582088f969ab604e8ff10be53e60e419772c.webp",
  },
  "precise-jinhsi-signature": {
    assetId: "21010026",
    iconPath:
      "/assets/wuwa/objects/69f1c2149a7a717f16f6d3c429b73cdd6b9834c99e7d05b5e9f8ada81f9392e6.webp",
  },
  "precise-galbrena-signature": {
    assetId: "21030036",
    iconPath:
      "/assets/wuwa/objects/eb80e9cf82268633a623c1267fff3c5c5454c1662e67333ae06d55f7d497b911.webp",
  },
  "precise-iuno-signature": {
    assetId: "21040046",
    iconPath:
      "/assets/wuwa/objects/0c7cb221df644bbe20544249708581530ece8705728c6f450d34ccc51a7e43a9.webp",
  },
  "precise-shorekeeper-signature": {
    assetId: "21050036",
    iconPath:
      "/assets/wuwa/objects/ee86b6e9a7c8fc4594e2e7cd5a48ab490f31c69aa1f3bbc68d7b9dfb5d54fda0.webp",
  },
  "precise-hiyuki-signature": {
    assetId: "21020086",
    iconPath:
      "/assets/wuwa/objects/cf9cd2ba3811c05f571ba48001d52d3ccbee209d047cc7a683f62571b5dba349.webp",
  },
} as const satisfies Record<string, WeaponUiAsset>;

export function getWeaponUiAssetId(weaponId: string): string | undefined {
  return (PROMOTED_WEAPON_UI_ASSETS as Record<string, WeaponUiAsset>)[weaponId]
    ?.assetId;
}

export function requireWeaponUiAssetId(weaponId: string): string {
  const assetId = getWeaponUiAssetId(weaponId);
  if (!assetId) {
    throw new Error(`Missing verified Wuwa UI asset ID for promoted weapon: ${weaponId}`);
  }
  return assetId;
}

export function getWeaponUiIconPath(
  weaponId: string,
): `/assets/wuwa/objects/${string}` | undefined {
  return (PROMOTED_WEAPON_UI_ASSETS as Record<string, WeaponUiAsset>)[weaponId]
    ?.iconPath;
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
