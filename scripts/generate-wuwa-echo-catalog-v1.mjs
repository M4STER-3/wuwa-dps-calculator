import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectEchoCatalogV1 } from "./lib/echo-catalog-projection.mjs";

const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 512 * 1024;
const root = path.resolve(process.cwd());
const inputPath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const outputPath = path.resolve(root, "public/data/wuwa/echo-catalog-v1.json");
const modulePath = path.resolve(root, "src/generated/echo-catalog-v1.ts");
const outputDirectory = path.dirname(outputPath);
const moduleDirectory = path.dirname(modulePath);
const temporaryPath = path.join(outputDirectory, `.echo-catalog-v1.${process.pid}.tmp`);
const temporaryModulePath = path.join(moduleDirectory, `.echo-catalog-v1.${process.pid}.tmp`);

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

async function atomicWrite(target, temporary, content, label) {
  const bytes = Buffer.byteLength(content);
  if (bytes <= 0 || bytes > MAX_OUTPUT_BYTES) {
    throw new Error(`${label} size ${bytes} is outside the allowed range`);
  }
  await rejectSymlink(target, label, true);
  await rejectSymlink(temporary, `${label} temporary output`, true);
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx", mode: 0o644 });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  return bytes;
}

assertContained(inputPath, "Echo catalog input");
assertContained(outputPath, "Echo catalog output");
assertContained(modulePath, "Echo catalog module");
await rejectSymlink(inputPath, "Echo catalog input");

const inputMetadata = await stat(inputPath);
if (!inputMetadata.isFile()) throw new Error("Echo catalog input must be a regular file");
if (inputMetadata.size <= 0 || inputMetadata.size > MAX_SOURCE_BYTES) {
  throw new Error(`Echo catalog input size ${inputMetadata.size} is outside the allowed range`);
}

await mkdir(outputDirectory, { recursive: true });
await mkdir(moduleDirectory, { recursive: true });
await assertRealDirectoryContained(path.dirname(inputPath), "Echo catalog input directory");
await assertRealDirectoryContained(outputDirectory, "Echo catalog output directory");
await assertRealDirectoryContained(moduleDirectory, "Echo catalog module directory");

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
const moduleSerialized = `/* Generated browser-safe Echo catalog. Do not edit manually. */\nexport const generatedEchoCatalogV1 = ${JSON.stringify(projection)} as const;\n`;
const bytes = await atomicWrite(outputPath, temporaryPath, serialized, "Echo catalog output");
await atomicWrite(modulePath, temporaryModulePath, moduleSerialized, "Echo catalog module");

console.log(
  `Generated ${path.relative(root, outputPath)} and ${path.relative(root, modulePath)} with ${projection.echoes.length} Echoes and ${projection.sonataSets.length} Sonata Sets (${bytes} bytes JSON).`,
);