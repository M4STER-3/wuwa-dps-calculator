import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { verifyWuWaAssetTree } from "./verify-wuwa-assets.mjs";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function webpFixture(tag) {
  return Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    Buffer.from([tag & 0xff, 0, 0, 0]),
    Buffer.from("WEBP", "ascii"),
    Buffer.from([tag & 0xff, 1, 2, 3]),
  ]);
}

function assetRecord(hash, bytes, sourceUrl = "https://cdn.encore.moe/assets/test.webp") {
  return {
    path: `/assets/wuwa/objects/${hash}.webp`,
    sourceUrl,
    contentType: "image/webp",
    bytes: bytes.length,
    sha256: hash,
  };
}

function manifestFor(hash, bytes) {
  const record = assetRecord(hash, bytes);
  return {
    schemaVersion: 2,
    source: "Encore.moe",
    sourceApi: "https://api-v2.encore.moe/api/en",
    gameVersion: "Release",
    generatedAt: "2026-08-17T00:00:00.000Z",
    categories: ["characters", "weapons", "echoes"],
    storage: {
      strategy: "sha256-content-addressed",
      root: "/assets/wuwa/objects",
    },
    security: {
      allowedFormats: ["image/png", "image/jpeg", "image/webp"],
      maxImageBytes: 8 * 1024 * 1024,
      maxRemoteBytesPerRun: 1024 * 1024 * 1024,
      maxAssetsPerRun: 10_000,
      maxImagesPerEntity: 96,
      optionalMissingHttp404: 0,
    },
    entities: {
      characters: {
        "1001": {
          sourceId: "1001",
          entityKey: "characters:1001",
          name: "Fixture Character",
          assets: { "list-roleheadicon": record },
        },
      },
      weapons: {
        "2001": {
          sourceId: "2001",
          entityKey: "weapons:2001",
          name: "Fixture Weapon",
          assets: { "list-icon": record },
        },
      },
      echoes: {
        "3001": {
          sourceId: "3001",
          entityKey: "echoes:3001",
          name: "Fixture Echo",
          assets: { "list-icon": record },
        },
      },
    },
  };
}

async function expectReject(label, fn, pattern) {
  let thrown = null;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  }
  if (!thrown) throw new Error(`${label}: expected verifier rejection`);
  if (pattern && !pattern.test(String(thrown.message ?? thrown))) {
    throw new Error(`${label}: unexpected error: ${String(thrown.message ?? thrown)}`);
  }
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "wuwa-asset-verifier-"));
const assetRoot = path.join(tempRoot, "public", "assets", "wuwa");
const objectsRoot = path.join(assetRoot, "objects");
const manifestPath = path.join(assetRoot, "manifest.json");

try {
  await mkdir(objectsRoot, { recursive: true });
  const bytes = webpFixture(7);
  const hash = sha256(bytes);
  const objectPath = path.join(objectsRoot, `${hash}.webp`);
  const manifest = manifestFor(hash, bytes);

  await writeFile(objectPath, bytes);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const summary = await verifyWuWaAssetTree(assetRoot);
  if (summary.logicalAssets !== 3) throw new Error("expected three logical assets");
  if (summary.uniqueObjects !== 1) throw new Error("expected one content-addressed object");
  if (summary.deduplicatedAssociations !== 2) throw new Error("expected two deduplicated associations");

  await writeFile(objectPath, Buffer.from("RIFFbad!WEBPbad!", "ascii"));
  await expectReject("corrupted object", () => verifyWuWaAssetTree(assetRoot), /byte-size mismatch|SHA-256 mismatch/);
  await writeFile(objectPath, bytes);

  const orphanBytes = webpFixture(8);
  const orphanHash = sha256(orphanBytes);
  const orphanPath = path.join(objectsRoot, `${orphanHash}.webp`);
  await writeFile(orphanPath, orphanBytes);
  await expectReject("orphan object", () => verifyWuWaAssetTree(assetRoot), /unreferenced object remains/);
  await unlink(orphanPath);

  const externalManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  externalManifest.entities.characters["1001"].assets["list-roleheadicon"].sourceUrl = "https://example.com/not-encore.webp";
  await writeFile(manifestPath, `${JSON.stringify(externalManifest, null, 2)}\n`, "utf8");
  await expectReject("external source", () => verifyWuWaAssetTree(assetRoot), /reviewed Encore image boundary/);

  const promoManifest = manifestFor(hash, bytes);
  promoManifest.entities.characters["1001"].assets["promo-icon"] = assetRecord(hash, bytes);
  await writeFile(manifestPath, `${JSON.stringify(promoManifest, null, 2)}\n`, "utf8");
  await expectReject("advertising role", () => verifyWuWaAssetTree(assetRoot), /advertisement\/tracking role/);

  await writeFile(manifestPath, `${JSON.stringify(manifestFor(hash, bytes), null, 2)}\n`, "utf8");
  const missingRequired = JSON.parse(await readFile(manifestPath, "utf8"));
  missingRequired.entities.echoes["3001"].assets = {};
  await writeFile(manifestPath, `${JSON.stringify(missingRequired, null, 2)}\n`, "utf8");
  await expectReject("missing required role", () => verifyWuWaAssetTree(assetRoot), /missing required role/);

  console.log("WuWa asset verifier tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
