import type {
  NumericStatProgression,
  NumericStatProgressionPoint,
} from "./schema";

export interface ExactProgressionSelection {
  level: number;
  /** Required only when the requested level has distinct pre/post ascension points. */
  ascended?: boolean;
}

function fail(label: string, message: string): never {
  throw new Error(`Exact stat progression rejected ${label}: ${message}`);
}

function assertSelection(selection: ExactProgressionSelection, label: string) {
  if (!Number.isInteger(selection.level) || selection.level < 1 || selection.level > 90) {
    fail(`${label}.level`, "must be an integer from 1 through 90");
  }
  if (
    selection.ascended !== undefined &&
    typeof selection.ascended !== "boolean"
  ) {
    fail(`${label}.ascended`, "must be boolean when present");
  }
}

function assertPoint(point: NumericStatProgressionPoint, label: string) {
  if (!Number.isInteger(point.level) || point.level < 1 || point.level > 90) {
    fail(`${label}.level`, "is outside the reviewed game-level range");
  }
  if (
    typeof point.value !== "number" ||
    !Number.isFinite(point.value) ||
    point.value < 0
  ) {
    fail(`${label}.value`, "must be a finite non-negative number");
  }
  if (point.ascended !== undefined && typeof point.ascended !== "boolean") {
    fail(`${label}.ascended`, "must be boolean when present");
  }
}

/**
 * Resolves one exact progression point without interpolation or implicit
 * ascension choices. At duplicated ascension boundaries the caller must state
 * whether the requested panel is pre- or post-ascension.
 */
export function resolveExactProgressionPoint(
  progression: NumericStatProgression,
  selection: ExactProgressionSelection,
  label = "progression",
): NumericStatProgressionPoint {
  if (!progression || progression.interpolation !== "none") {
    fail(label, "must declare interpolation: none");
  }
  if (!Array.isArray(progression.points) || progression.points.length === 0) {
    fail(`${label}.points`, "must contain exact source points");
  }
  assertSelection(selection, `${label}.selection`);

  const matches: NumericStatProgressionPoint[] = [];
  for (let index = 0; index < progression.points.length; index += 1) {
    const point = progression.points[index];
    assertPoint(point, `${label}.points[${index}]`);
    if (point.level === selection.level) matches.push(point);
  }

  if (matches.length === 0) {
    fail(label, `has no exact point for level ${selection.level}`);
  }
  if (matches.length === 1) {
    if (matches[0]!.ascended !== undefined) {
      fail(
        label,
        `level ${selection.level} has an ascension marker but no reviewed counterpart`,
      );
    }
    if (selection.ascended !== undefined) {
      fail(
        `${label}.selection.ascended`,
        `must be omitted because level ${selection.level} is not an ascension boundary`,
      );
    }
    return matches[0]!;
  }
  if (matches.length !== 2) {
    fail(label, `has ${matches.length} points for level ${selection.level}; expected at most two`);
  }
  if (selection.ascended === undefined) {
    fail(
      `${label}.selection.ascended`,
      `is required for the pre/post ascension boundary at level ${selection.level}`,
    );
  }

  const pre = matches.filter((point) => point.ascended === false);
  const post = matches.filter((point) => point.ascended === true);
  if (pre.length !== 1 || post.length !== 1) {
    fail(
      label,
      `level ${selection.level} must contain exactly one pre- and one post-ascension point`,
    );
  }
  return selection.ascended ? post[0]! : pre[0]!;
}
