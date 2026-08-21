"use client";

import { WuwaProjectedAssetMedia } from "@/components/ui/wuwa-projected-asset-media";

const HERO_ROLES = [
  "detail-roleportrait",
  "list-roleportrait",
  "list-roleheadicon",
] as const;

export function ResonatorHeroArtwork({
  assetId,
  name,
}: {
  assetId: string;
  name: string;
}) {
  if (name === "Cantarella") {
    return (
      <div
        style={{
          display: "grid",
          width: "min(100%, 280px)",
          minHeight: 250,
          margin: "0 auto 16px",
          placeItems: "center",
          border: "1px dashed rgba(87, 101, 134, 0.3)",
          borderRadius: 18,
          background: "rgba(247, 249, 253, 0.82)",
          padding: 20,
          textAlign: "center",
        }}
        role="img"
        aria-label="Grand visuel de Cantarella désactivé"
      >
        <div>
          <strong
            style={{
              display: "block",
              fontSize: "0.82rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Image off
          </strong>
          <span
            style={{
              display: "block",
              marginTop: 7,
              color: "#748099",
              fontSize: "0.68rem",
              lineHeight: 1.5,
            }}
          >
            Portrait tête uniquement pour Cantarella.
          </span>
        </div>
      </div>
    );
  }

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
