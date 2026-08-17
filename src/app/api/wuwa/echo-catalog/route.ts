import { projectEchoCatalogV1 } from "@/game-data/echo-catalog-projection";

const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(request: Request) {
  try {
    const sourceUrl = new URL("/data/wuwa/game-database-v1.json", request.url);
    const sourceResponse = await fetch(sourceUrl, { cache: "force-cache" });
    if (!sourceResponse.ok) {
      return Response.json(
        { error: "Echo catalog unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const source: unknown = await sourceResponse.json();
    const projection = projectEchoCatalogV1(source);
    return Response.json(projection, {
      headers: {
        "Cache-Control": CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "Failed to project promoted Echo catalog",
      error instanceof Error ? error.message : "unknown error",
    );
    return Response.json(
      { error: "Echo catalog unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
