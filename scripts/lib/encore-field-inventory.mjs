const MAX_PATHS = 5_000;
const MAX_DEPTH = 10;
const MAX_ARRAY_ITEMS_PER_NODE = 50;
const MAX_SAMPLES_PER_PATH = 3;
const MAX_SAMPLE_LENGTH = 240;

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function createRecord() {
  return {
    observations: 0,
    types: Object.create(null),
    string: {
      count: 0,
      minLength: null,
      maxLength: 0,
      urlLike: 0,
      htmlLike: 0,
      scriptLike: 0,
      controlCharacters: 0,
      samples: [],
    },
    number: {
      count: 0,
      integerCount: 0,
      min: null,
      max: null,
    },
    boolean: {
      trueCount: 0,
      falseCount: 0,
    },
  };
}

function isUrlLike(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function hasHtmlLikeMarkup(value) {
  return /<\s*\/?\s*[a-z][^>]*>/i.test(value);
}

function hasScriptLikeContent(value) {
  return /<\s*script\b|javascript\s*:|data\s*:\s*text\/html|on[a-z]+\s*=/i.test(value);
}

function hasControlCharacters(value) {
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value);
}

function safeSample(value) {
  if (isUrlLike(value)) {
    try {
      const url = new URL(value);
      return `[url:${url.protocol}//${url.hostname}]`;
    } catch {
      return "[url]";
    }
  }
  if (hasScriptLikeContent(value)) return "[omitted:script-like-content]";
  if (hasHtmlLikeMarkup(value)) return "[omitted:html-like-content]";

  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SAMPLE_LENGTH);
}

function observeScalar(record, value) {
  const type = valueType(value);
  record.observations++;
  record.types[type] = (record.types[type] ?? 0) + 1;

  if (typeof value === "string") {
    const length = value.length;
    record.string.count++;
    record.string.minLength = record.string.minLength === null ? length : Math.min(record.string.minLength, length);
    record.string.maxLength = Math.max(record.string.maxLength, length);
    if (isUrlLike(value)) record.string.urlLike++;
    if (hasHtmlLikeMarkup(value)) record.string.htmlLike++;
    if (hasScriptLikeContent(value)) record.string.scriptLike++;
    if (hasControlCharacters(value)) record.string.controlCharacters++;

    const sample = safeSample(value);
    if (sample && !record.string.samples.includes(sample) && record.string.samples.length < MAX_SAMPLES_PER_PATH) {
      record.string.samples.push(sample);
    }
    return;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    record.number.count++;
    if (Number.isInteger(value)) record.number.integerCount++;
    record.number.min = record.number.min === null ? value : Math.min(record.number.min, value);
    record.number.max = record.number.max === null ? value : Math.max(record.number.max, value);
    return;
  }

  if (typeof value === "boolean") {
    if (value) record.boolean.trueCount++;
    else record.boolean.falseCount++;
  }
}

export function createFieldInventoryAccumulator() {
  return new Map();
}

export function collectFieldInventory(root, prefix, accumulator) {
  const stack = [{ value: root, path: prefix, depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current.depth > MAX_DEPTH) continue;

    if (current.value === null || typeof current.value !== "object") {
      let record = accumulator.get(current.path);
      if (!record) {
        if (accumulator.size >= MAX_PATHS) throw new Error(`Field inventory exceeded ${MAX_PATHS} paths`);
        record = createRecord();
        accumulator.set(current.path, record);
      }
      observeScalar(record, current.value);
      continue;
    }

    if (Array.isArray(current.value)) {
      for (const child of current.value.slice(0, MAX_ARRAY_ITEMS_PER_NODE)) {
        stack.push({ value: child, path: `${current.path}[]`, depth: current.depth + 1 });
      }
      continue;
    }

    for (const [key, child] of Object.entries(current.value)) {
      stack.push({ value: child, path: `${current.path}.${key}`, depth: current.depth + 1 });
    }
  }
}

export function serializeFieldInventory(accumulator) {
  return [...accumulator.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, record]) => {
      const result = {
        path,
        observations: record.observations,
        types: Object.fromEntries(Object.entries(record.types).sort(([a], [b]) => a.localeCompare(b))),
      };

      if (record.string.count > 0) {
        result.string = {
          count: record.string.count,
          minLength: record.string.minLength,
          maxLength: record.string.maxLength,
          urlLike: record.string.urlLike,
          htmlLike: record.string.htmlLike,
          scriptLike: record.string.scriptLike,
          controlCharacters: record.string.controlCharacters,
          samples: record.string.samples,
        };
      }
      if (record.number.count > 0) {
        result.number = {
          count: record.number.count,
          integerCount: record.number.integerCount,
          min: record.number.min,
          max: record.number.max,
        };
      }
      if (record.boolean.trueCount > 0 || record.boolean.falseCount > 0) {
        result.boolean = {
          trueCount: record.boolean.trueCount,
          falseCount: record.boolean.falseCount,
        };
      }
      return result;
    });
}

export const fieldInventoryLimits = Object.freeze({
  maxPaths: MAX_PATHS,
  maxDepth: MAX_DEPTH,
  maxArrayItemsPerNode: MAX_ARRAY_ITEMS_PER_NODE,
  maxSamplesPerPath: MAX_SAMPLES_PER_PATH,
  maxSampleLength: MAX_SAMPLE_LENGTH,
});
