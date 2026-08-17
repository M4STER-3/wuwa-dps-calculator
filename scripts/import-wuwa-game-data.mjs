import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  ENCORE_API_BASE,
  ENCORE_DATASET,
  ENCORE_RESOURCES,
  createEncoreBudget,
  encoreClientLimits,
  fetchEncoreJson,
  getEncoreCollection,
  getEncoreEntityId,
  sha256,
} from "./lib/encore-client.mjs";

const REPO_ROOT = path.resolve(process.cwd());
const RAW_ROOT = path.join(REPO_ROOT, "data", "sources", "encore", "release");
const TEMP_ROOT = path.join(REPO_ROOT, ".tmp", "wuwa-game-data-import");
const AUDIT_OUTPUT_ROOT = path.join(REPO_ROOT, ".tmp", "wuwa-game-data-audit");
const MAX_ENTITIES_PER_RESOURCE = 1000;
const MAX_SCHEMA_PATHS = 5000;
const MAX_SCHEMA_DEPTH = 8;
const MANIFEST_SCHEMA_VERSION = 1;
const ALLOWED_ARGS = new Set(["--audit-only"]);

const auditOnly = process.argv.includes("--audit-only");

function assertArguments() {
  for (const arg of process.argv.slice(2)) {
    if (!ALLOWED_ARGS.has(arg)) throw new Error(`Unsupported game-data import argument: ${arg}`);
  }
}

function relativeRepoPath(filePath) {
  const relative = path.relative(REPO_ROOT, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escaped repository root: ${filePath}`);
  }
  return relative.split(path.sep).join("/");
}

async function lstatIfPresent(filePath) {
  try {
    return await lstat(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function assertNoSymlinkComponents(targetPath, trustedRoot) {
  const root = path.resolve(trustedRoot);
  const target = path.resolve(targetPath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escaped trusted root: ${target}`);
  }

  let current = root;
  const rootStats = await lstatIfPresent(root);
  if (rootStats?.isSymbolicLink()) throw new Error(`Symbolic link forbidden in import path: ${root}`);
  if (rootStats && !rootStats.isDirectory()) throw new Error(`Import path component is not a directory: ${root}`);

  for (const segment of relative ? relative.split(path.sep) : []) {
    current = path.join(current, segment);
    const stats = await lstatIfPresent(current);
    if (!stats) continue;
    if (stats.isSymbolicLink()) throw new Error(`Symbolic link forbidden in import path: ${current}`);
    if (!stats.isDirectory()) throw new Error(`Import path component is not a directory: ${current}`);
  }
}

function safeDetailFilename(sourceId) {
  return `${sha256(Buffer.from(sourceId, "utf8")).slice(0, 32)}.json`;
}

async function writeRawFile(filePath, raw) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o755 });
  await writeFile(filePath, raw, { flag: "wx", mode: 0o644 });
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function collectSchemaPaths(root, prefix, accumulator) {
  const stack = [{ value: root, path: prefix, depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const type = valueType(current.value);
    const existing = accumulator.get(current.path) ?? new Map();
    existing.set(type, (existing.get(type) ?? 0) + 1);
    accumulator.set(current.path, existing);
    if (accumulator.size > MAX_SCHEMA_PATHS) throw new Error("Schema report exceeded path limit");
    if (current.depth >= MAX_SCHEMA_DEPTH || current.value === null || typeof current.value !== "object") continue;

    if (Array.isArray(current.value)) {
      for (const child of current.value.slice(0, 20)) {
        stack.push({ value: child, path: `${current.path}[]`, depth: current.depth + 1 });
      }
      continue;
    }

    for (const [key, child] of Object.entries(current.value)) {
      stack.push({ value: child, path: `${current.path}.${key}`, depth: current.depth + 1 });
    }
  }
}

function serializeSchemaReport(accumulator) {
  return [...accumulator.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pathName, types]) => ({
      path: pathName,
      types: [...types.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, count]) => ({ type, observations: count })),
    }));
}

function validatePreviousManifest(value) {
  if (!value || typeof value !== "object" || value.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error("Existing Encore snapshot manifest has an unsupported schema");
  }
  if (value.dataset !== ENCORE_DATASET || value.sourceApi !== ENCORE_API_BASE) {
    throw new Error("Existing Encore snapshot manifest points at an unexpected source/dataset");
  }
  if (!value.resources || typeof value.resources !== "object") {
    throw new Error("Existing Encore snapshot manifest has no resources object");
  }
  for (const resourceName of Object.keys(ENCORE_RESOURCES)) {
    const resource = value.resources[resourceName];
    if (!resource || !Array.isArray(resource.entities)) {
      throw new Error(`Existing Encore snapshot manifest is missing ${resourceName}`);
    }
    const seen = new Set();
    for (const entity of resource.entities) {
      if (!entity || typeof entity.sourceId !== "string" || typeof entity.detailSha256 !== "string") {
        throw new Error(`Existing Encore snapshot manifest has invalid ${resourceName} entity metadata`);
      }
      if (seen.has(entity.sourceId)) throw new Error(`Existing manifest duplicates ${resourceName}:${entity.sourceId}`);
      seen.add(entity.sourceId);
    }
  }
  return value;
}

async function loadPreviousManifest() {
  const filePath = path.join(RAW_ROOT, "manifest.json");
  try {
    const raw = await readFile(filePath, "utf8");
    if (raw.length > 4 * 1024 * 1024) throw new Error("Existing Encore manifest is unexpectedly large");
    return validatePreviousManifest(JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function buildDiff(previousManifest, nextResources) {
  const diff = {};
  let blocked = false;

  for (const resourceName of Object.keys(ENCORE_RESOURCES)) {
    const previousEntities = previousManifest?.resources?.[resourceName]?.entities ?? [];
    const previousById = new Map(previousEntities.map((entity) => [entity.sourceId, entity]));
    const nextById = new Map(nextResources[resourceName].entities.map((entity) => [entity.sourceId, entity]));
    const added = [];
    const removed = [];
    const modified = [];

    for (const [sourceId, entity] of nextById) {
      const previous = previousById.get(sourceId);
      if (!previous) added.push(sourceId);
      else if (previous.detailSha256 !== entity.detailSha256) modified.push(sourceId);
    }
    for (const sourceId of previousById.keys()) {
      if (!nextById.has(sourceId)) removed.push(sourceId);
    }
    if (removed.length > 0) blocked = true;

    diff[resourceName] = {
      previousCount: previousEntities.length,
      nextCount: nextResources[resourceName].entities.length,
      added,
      modified,
      removed,
    };
  }

  return { blockedByRemovals: blocked, resources: diff };
}

async function writeAuditOutputs(manifest, schemaReport) {
  await assertNoSymlinkComponents(AUDIT_OUTPUT_ROOT, REPO_ROOT);
  await rm(AUDIT_OUTPUT_ROOT, { recursive: true, force: true });
  await mkdir(AUDIT_OUTPUT_ROOT, { recursive: true, mode: 0o755 });
  await writeFile(
    path.join(AUDIT_OUTPUT_ROOT, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx", mode: 0o644 },
  );
  await writeFile(
    path.join(AUDIT_OUTPUT_ROOT, "schema-report.json"),
    `${JSON.stringify(schemaReport, null, 2)}\n`,
    { flag: "wx", mode: 0o644 },
  );
}

async function promoteSnapshot(stageRoot) {
  await assertNoSymlinkComponents(path.join(REPO_ROOT, "data"), REPO_ROOT);
  await assertNoSymlinkComponents(path.dirname(RAW_ROOT), REPO_ROOT);
  const rawStats = await lstatIfPresent(RAW_ROOT);
  if (rawStats?.isSymbolicLink()) throw new Error("Encore RAW root must not be a symbolic link");
  if (rawStats && !rawStats.isDirectory()) throw new Error("Encore RAW root must be a directory");

  const backupPath = `${RAW_ROOT}.backup-${randomUUID()}`;
  let movedPrevious = false;
  try {
    await mkdir(path.dirname(RAW_ROOT), { recursive: true, mode: 0o755 });
    if (rawStats) {
      await rename(RAW_ROOT, backupPath);
      movedPrevious = true;
    }
    await rename(stageRoot, RAW_ROOT);
    if (movedPrevious) await rm(backupPath, { recursive: true, force: true });
  } catch (error) {
    const currentStats = await lstatIfPresent(RAW_ROOT);
    if (!currentStats && movedPrevious) {
      await rename(backupPath, RAW_ROOT).catch(() => {});
    }
    throw error;
  }
}

async function main() {
  assertArguments();
  const importedAt = new Date().toISOString();
  const budget = createEncoreBudget();
  const previousManifest = await loadPreviousManifest();
  const runRoot = path.join(TEMP_ROOT, randomUUID());
  const stageRoot = path.join(runRoot, "release");
  const schemaPaths = new Map();
  const files = [];
  const resources = {};

  await assertNoSymlinkComponents(TEMP_ROOT, REPO_ROOT);
  await mkdir(stageRoot, { recursive: true, mode: 0o755 });

  try {
    for (const resourceName of Object.keys(ENCORE_RESOURCES)) {
      const resourceRoot = path.join(stageRoot, resourceName);
      const listResult = await fetchEncoreJson(resourceName, { budget });
      const listPath = path.join(resourceRoot, "list.json");
      await writeRawFile(listPath, listResult.raw);
      files.push({
        path: relativeRepoPath(path.join(RAW_ROOT, resourceName, "list.json")),
        sha256: listResult.sha256,
        bytes: listResult.bytes,
        sourceUrl: listResult.url,
      });
      collectSchemaPaths(listResult.json, `${resourceName}.list`, schemaPaths);

      const listEntities = getEncoreCollection(listResult.json, resourceName);
      if (listEntities.length > MAX_ENTITIES_PER_RESOURCE) {
        throw new Error(`${resourceName} exceeded ${MAX_ENTITIES_PER_RESOURCE} entities`);
      }

      const seenIds = new Set();
      const entities = [];
      for (const listEntity of listEntities) {
        const sourceId = getEncoreEntityId(listEntity);
        if (!sourceId) throw new Error(`${resourceName} contains an entity without a stable id`);
        if (seenIds.has(sourceId)) throw new Error(`${resourceName} contains duplicate source id ${sourceId}`);
        seenIds.add(sourceId);

        const detailResult = await fetchEncoreJson(resourceName, { sourceId, budget });
        const detailFile = safeDetailFilename(sourceId);
        const detailPath = path.join(resourceRoot, "details", detailFile);
        await writeRawFile(detailPath, detailResult.raw);
        collectSchemaPaths(detailResult.json, `${resourceName}.detail`, schemaPaths);
        files.push({
          path: relativeRepoPath(path.join(RAW_ROOT, resourceName, "details", detailFile)),
          sha256: detailResult.sha256,
          bytes: detailResult.bytes,
          sourceUrl: detailResult.url,
        });
        entities.push({
          sourceId,
          detailFile,
          detailSha256: detailResult.sha256,
          detailBytes: detailResult.bytes,
        });
      }

      entities.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
      resources[resourceName] = {
        listSha256: listResult.sha256,
        listBytes: listResult.bytes,
        count: entities.length,
        entities,
      };
    }

    const diff = buildDiff(previousManifest, resources);
    const schemaReport = {
      schemaVersion: 1,
      sourceProvider: "encore",
      dataset: ENCORE_DATASET,
      observedAt: importedAt,
      paths: serializeSchemaReport(schemaPaths),
    };
    const manifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      sourceProvider: "encore",
      sourceApi: ENCORE_API_BASE,
      language: "en",
      dataset: ENCORE_DATASET,
      importedAt,
      security: {
        redirects: "disabled",
        acceptedContentType: "application/json",
        maxResponseBytes: encoreClientLimits.maxResponseBytes,
        maxTotalRemoteBytes: budget.maxBytes,
        requestTimeoutMs: encoreClientLimits.requestTimeoutMs,
        remoteBytesRead: budget.bytesRead,
      },
      resources,
      files,
      diff,
    };

    await writeFile(path.join(stageRoot, "schema-report.json"), `${JSON.stringify(schemaReport, null, 2)}\n`, {
      flag: "wx",
      mode: 0o644,
    });
    await writeFile(path.join(stageRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx",
      mode: 0o644,
    });

    const summary = {
      auditOnly,
      importedAt,
      remoteBytesRead: budget.bytesRead,
      counts: Object.fromEntries(Object.entries(resources).map(([key, value]) => [key, value.count])),
      diff,
      schemaPathCount: schemaReport.paths.length,
      auditReportPath: auditOnly ? relativeRepoPath(AUDIT_OUTPUT_ROOT) : null,
      promoted: !auditOnly && !diff.blockedByRemovals,
    };
    console.log(`WUWA_GAME_DATA_IMPORT_REPORT=${JSON.stringify(summary)}`);

    if (diff.blockedByRemovals) {
      throw new Error("Encore import blocked: one or more previously known entities disappeared from the source");
    }

    if (auditOnly) {
      await writeAuditOutputs(manifest, schemaReport);
      return;
    }
    await promoteSnapshot(stageRoot);
  } finally {
    await rm(runRoot, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
