"use client";

import { useEffect, useMemo, useState } from "react";

import { WuwaAssetMedia } from "@/components/ui/wuwa-asset-media";
import {
  findWuwaUiAssetPathV1,
  isWuwaUiAssetProjectionV1,
  type WuwaUiAssetProjectionV1,
} from "@/game-data/ui-asset-projection";

export function ResonatorHeroArtwork({
  assetId,
  name,
}: {
  assetId: string;
  name: string;
}) {
  const [projection, setProjection] = useState<WuwaUiAssetProjectionV1 | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProjection() {
      try {
        const response = await fetch("/api/wuwa/ui-assets", {
          cache: "force-cache",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: unknown = await response.json();
        if (!isWuwaUiAssetProjectionV1(payload)) {
          throw new Error("projection d’assets rejetée");
        }
        if (!cancelled) setProjection(payload);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void loadProjection();
    return () => {
      cancelled = true;
    };
  }, []);

  const src = useMemo(
    () =>
      projection
        ? findWuwaUiAssetPathV1(projection, "characters", assetId, [
            "detail-roleportrait",
          ])
        : undefined,
    [assetId, projection],
  );

  return (
    <WuwaAssetMedia
      src={failed ? undefined : src}
      alt={`Artwork de ${name}`}
      role="hero"
      sourceRole={src ? "detail-roleportrait" : undefined}
      fallbackLabel={`Artwork de ${name} indisponible`}
      sizes="(max-width: 780px) 180px, 280px"
    />
  );
}
