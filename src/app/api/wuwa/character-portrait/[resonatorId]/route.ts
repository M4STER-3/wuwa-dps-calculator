import {
  findWuwaUiAssetPathV1,
  isWuwaUiAssetProjectionV1,
} from "@/game-data/ui-asset-projection";
import { getResonatorUiAssetId } from "@/game-data/resonator-ui-asset-ids";

const portraitRoles = ["list-roleheadicon"] as const;

export async function GET(
  request: Request,
  context: { params: Promise<{ resonatorId: string }> },
) {
  const { resonatorId } = await context.params;
  const assetId = getResonatorUiAssetId(resonatorId);

  if (!assetId) {
    return new Response("Unknown promoted Resonator", {
      status: 404,
      headers: { "X-Content-Type-Options": "nosniff" },
    });
  }

  const projectionResponse = await fetch(
    new URL("/data/wuwa/ui-asset-projection-v1.json", request.url),
    { cache: "force-cache" },
  );

  if (!projectionResponse.ok) {
    return new Response("UI asset projection unavailable", {
      status: 503,
      headers: { "X-Content-Type-Options": "nosniff" },
    });
  }

  const payload: unknown = await projectionResponse.json();
  if (!isWuwaUiAssetProjectionV1(payload)) {
    return new Response("UI asset projection rejected", {
      status: 503,
      headers: { "X-Content-Type-Options": "nosniff" },
    });
  }

  const localPath = findWuwaUiAssetPathV1(
    payload,
    "characters",
    assetId,
    portraitRoles,
  );

  if (!localPath) {
    return new Response("Portrait unavailable", {
      status: 404,
      headers: { "X-Content-Type-Options": "nosniff" },
    });
  }

  const assetResponse = await fetch(new URL(localPath, request.url), {
    cache: "force-cache",
  });
  if (!assetResponse.ok || !assetResponse.body) {
    return new Response("Portrait asset unavailable", {
      status: 503,
      headers: { "X-Content-Type-Options": "nosniff" },
    });
  }

  return new Response(assetResponse.body, {
    status: 200,
    headers: {
      "Content-Type": assetResponse.headers.get("Content-Type") ?? "image/webp",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
