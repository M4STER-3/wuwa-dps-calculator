import {
  findWuwaUiAssetPathV1,
  type WuwaUiAssetProjectionV1,
} from "./ui-asset-projection";

export const WUWA_ECHO_DISPLAY_ROLES = ["detail-icon", "list-icon"] as const;

const CANONICAL_ECHO_ID = /^echo:(\d{1,30})$/;

/**
 * Convert only the promoted canonical GameDatabase Echo identity into the
 * corresponding verified asset-manifest source ID. Display names are never
 * accepted as an identity bridge.
 */
export function getEchoUiAssetSourceId(echoId: string): string | undefined {
  const match = CANONICAL_ECHO_ID.exec(echoId);
  return match?.[1];
}

export function getEchoUiAssetPath(
  projection: WuwaUiAssetProjectionV1,
  echoId: string,
): string | undefined {
  const sourceId = getEchoUiAssetSourceId(echoId);
  if (!sourceId) return undefined;
  return findWuwaUiAssetPathV1(
    projection,
    "echoes",
    sourceId,
    WUWA_ECHO_DISPLAY_ROLES,
  );
}
