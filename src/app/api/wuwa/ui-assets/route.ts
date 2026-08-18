export function GET() {
  return new Response(null, {
    status: 307,
    headers: {
      Location: "/data/wuwa/ui-asset-projection-v1.json",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
