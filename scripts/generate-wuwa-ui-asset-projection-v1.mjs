import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectWuwaUiAssetsV1 } from "./lib/wuwa-ui-asset-projection.mjs";

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const root = path.resolve(process.cwd());
const inputPath = path.resolve(root, "public/assets/wuwa/manifest.json");
const outputPath = path.resolve(root, "public/data/wuwa/ui-asset-projection-v1.json");
const outputDirectory = path.dirname(outputPath);
const temporaryPath = path.join(outputDirectory, `.ui-asset-projection-v1.${process.pid}.tmp`);

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
    if (allowMissing && error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
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

assertContained(inputPath, "UI asset projection input");
assertContained(outputPath, "UI asset projection output");
await rejectSymlink(inputPath, "UI asset projection input");

const inputMetadata = await stat(inputPath);
if (!inputMetadata.isFile()) throw new Error("UI asset projection input must be a regular file");
if (inputMetadata.size <= 0 || inputMetadata.size > MAX_SOURCE_BYTES) {
  throw new Error(`UI asset projection input size ${inputMetadata.size} is outside the allowed range`);
}

await mkdir(outputDirectory, { recursive: true });
await assertRealDirectoryContained(path.dirname(inputPath), "UI asset projection input directory");
await assertRealDirectoryContained(outputDirectory, "UI asset projection output directory");
await rejectSymlink(outputPath, "UI asset projection output", true);
await rejectSymlink(temporaryPath, "UI asset projection temporary output", true);

let manifest;
try {
  manifest = JSON.parse(await readFile(inputPath, "utf8"));
} catch (error) {
  throw new Error(
    `Unable to parse verified asset manifest: ${error instanceof Error ? error.message : "unknown error"}`,
  );
}

const projection = projectWuwaUiAssetsV1(manifest);
const serialized = `${JSON.stringify(projection)}\n`;
const outputBytes = Buffer.byteLength(serialized);
if (outputBytes <= 0 || outputBytes > MAX_OUTPUT_BYTES) {
  throw new Error(`UI asset projection output size ${outputBytes} is outside the allowed range`);
}

try {
  await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
  await rename(temporaryPath, outputPath);
} catch (error) {
  await rm(temporaryPath, { force: true }).catch(() => undefined);
  throw error;
}

console.log(
  `Generated ${path.relative(root, outputPath)} with ${projection.counts.characters} characters, ${projection.counts.weapons} weapons, ${projection.counts.echoes} echoes and ${projection.counts.assets} local asset mappings (${outputBytes} bytes).`,
);
