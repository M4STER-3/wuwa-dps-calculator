"use client";

import { useEffect, useMemo, useState } from "react";

import {
  WuwaAssetMedia,
  type WuwaAssetMediaRole,
} from "./wuwa-asset-media";
import {
  findWuwaUiAssetPathV1,
  isWuwaUiAssetProjectionV1,
  type WuwaUiAssetCategoryV1,
  type WuwaUiAssetProjectionV1,
} from "@/game-data/ui-asset-projection";

let projectionPromise: Promise<WuwaUiAssetProjectionV1> | null = null;

function loadProjection(): Promise<WuwaUiAssetProjectionV1> {
  if (!projectionPromise) {
    projectionPromise = fetch("/api/wuwa/ui-assets", {
      cache: "force-cache",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: unknown = await response.json();
        if (!isWuwaUiAssetProjectionV1(payload)) {
          throw new Error("projection d’assets rejetée");
        }
        return payload;
      })
      .catch((error) => {
        projectionPromise = null;
        throw error;
      });
  }
  return projectionPromise;
}

export function WuwaProjectedAssetMedia({
  category,
  assetId,
  preferredRoles,
  alt,
  role,
  fallbackLabel,
  className,
  sizes,
}: {
  category: WuwaUiAssetCategoryV1;
  assetId?: string;
  preferredRoles: readonly string[];
  alt: string;
  role: WuwaAssetMediaRole;
  fallbackLabel?: string;
  className?: string;
  sizes?: string;
}) {
  const [projection, setProjection] = useState<WuwaUiAssetProjectionV1 | null>(null);
  const [failedAssetId, setFailedAssetId] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;

    let cancelled = false;
    void loadProjection()
      .then((value) => {
        if (!cancelled) setProjection(value);
      })
      .catch(() => {
        if (!cancelled) setFailedAssetId(assetId);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const failed = !assetId || failedAssetId === assetId;
  const src = useMemo(
    () =>
      !failed && projection && assetId
        ? findWuwaUiAssetPathV1(projection, category, assetId, preferredRoles)
        : undefined,
    [assetId, category, failed, preferredRoles, projection],
  );

  return (
    <WuwaAssetMedia
      src={src}
      alt={alt}
      role={role}
      sourceRole={src ? preferredRoles.join("/") : undefined}
      fallbackLabel={fallbackLabel}
      className={className}
      sizes={sizes}
    />
  );
}
