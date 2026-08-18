"use client";

import { WuwaProjectedAssetMedia } from "@/components/ui/wuwa-projected-asset-media";

const HERO_ROLES = ["detail-roleportrait"] as const;

export function ResonatorHeroArtwork({
  assetId,
  name,
}: {
  assetId: string;
  name: string;
}) {
  return (
    <div style={{ width: "min(100%, 280px)", margin: "0 auto 16px" }}>
      <WuwaProjectedAssetMedia
        category="characters"
        assetId={assetId}
        preferredRoles={HERO_ROLES}
        alt={`Artwork de ${name}`}
        role="hero"
        fallbackLabel={`Artwork de ${name} indisponible`}
        sizes="(max-width: 780px) 180px, 280px"
      />
    </div>
  );
}
