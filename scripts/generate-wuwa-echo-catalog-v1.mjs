import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectEchoCatalogV1 } from "./lib/echo-catalog-projection.mjs";

const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const root = path.resolve(process.cwd());
const inputPath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const outputPath = path.resolve(root, "public/data/wuwa/echo-catalog-v1.json");
const outputDirectory = path.dirname(outputPath);
const temporaryPath = path.join(outputDirectory, `.echo-catalog-v1.${process.pid}.tmp`);

function assertContained(candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes repository root`);
  }
}

async function rejectSymlink(candidate, label, allowMissing = false) {
  try {
    const metadata = await lstat(candidate);
    if (metadata.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  } catch (error) {
    if (allowMissing && error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

async function assertRealDirectoryContained(directory, label) {
  const realRoot = await realpath(root);
  const realDirectory = await realpath(directory);
  const relative = path.relative(realRoot, realDirectory);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} resolves outside repository root`);
  }
}

assertContained(inputPath, "Echo catalog input");
assertContained(outputPath, "Echo catalog output");
await rejectSymlink(inputPath, "Echo catalog input");

const inputMetadata = await stat(inputPath);
if (!inputMetadata.isFile()) throw new Error("Echo catalog input must be a regular file");
if (inputMetadata.size <= 0 || inputMetadata.size > MAX_SOURCE_BYTES) {
  throw new Error(`Echo catalog input size ${inputMetadata.size} is outside the allowed range`);
}

await mkdir(outputDirectory, { recursive: true });
await assertRealDirectoryContained(path.dirname(inputPath), "Echo catalog input directory");
await assertRealDirectoryContained(outputDirectory, "Echo catalog output directory");
await rejectSymlink(outputPath, "Echo catalog output", true);
await rejectSymlink(temporaryPath, "Echo catalog temporary output", true);

let source;
try {
  source = JSON.parse(await readFile(inputPath, "utf8"));
} catch (error) {
  throw new Error(
    `Unable to parse promoted GameDatabase: ${error instanceof Error ? error.message : "unknown error"}`,
  );
}

const projection = projectEchoCatalogV1(source);
const serialized = `${JSON.stringify(projection)}\n`;

try {
  await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
  await rename(temporaryPath, outputPath);
} catch (error) {
  await rm(temporaryPath, { force: true }).catch(() => undefined);
  throw error;
}

console.log(
  `Generated ${path.relative(root, outputPath)} with ${projection.echoes.length} Echoes and ${projection.sonataSets.length} Sonata Sets (${Buffer.byteLength(serialized)} bytes).`,
);
