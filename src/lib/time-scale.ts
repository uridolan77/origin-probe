import { scaleLinear } from "d3-scale";
import type { HistoricalDate } from "./schema";

/** Era bands for piecewise time scale (equal visual width per band). */
export const ERA_BANDS = [
  { id: "ancient", label: "Ancient", start: -800, end: 500 },
  { id: "medieval", label: "Medieval", start: 500, end: 1500 },
  { id: "earlyModern", label: "Early modern", start: 1500, end: 1800 },
  { id: "lateModern", label: "Late modern", start: 1800, end: 1950 },
  { id: "post1950", label: "Post-1950", start: 1950, end: 2030 },
] as const;

export type EraId = (typeof ERA_BANDS)[number]["id"];

export function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BCE`;
  if (year === 0) return "1 BCE";
  return String(year);
}

export function formatYearRange(start: number, end?: number): string {
  if (end == null || end === start) return formatYear(start);
  return `${formatYear(start)}–${formatYear(end)}`;
}

export function compareYears(a: number, b: number): number {
  return a - b;
}

export function compareHistoricalDates(
  a: Pick<HistoricalDate, "startYear" | "display">,
  b: Pick<HistoricalDate, "startYear" | "display">,
): number {
  return compareYears(a.startYear, b.startYear) || a.display.localeCompare(b.display);
}

export type TimeScale = {
  toUnit: (year: number) => number;
  formatYear: (year: number) => string;
  ticks: { year: number; unit: number; label: string }[];
  bands: { id: string; label: string; startUnit: number; endUnit: number }[];
  domainStart: number;
  domainEnd: number;
};

type Segment = {
  domainStart: number;
  domainEnd: number;
  rangeStart: number;
  rangeEnd: number;
  scale: (y: number) => number;
};

/**
 * Build a piecewise-linear era scale.
 * Each era band gets equal visual width so ancient→modern corpora remain readable.
 * Evaluated server-side only — no browser chart runtime.
 */
export function buildTimeScale(
  years: readonly number[],
  opts?: { paddingYears?: number },
): TimeScale {
  const padding = opts?.paddingYears ?? 5;
  const finite = years.filter((y) => Number.isFinite(y));
  const minY = finite.length ? Math.min(...finite) - padding : 1900;
  const maxY = finite.length ? Math.max(...finite) + padding : 2030;

  const active = ERA_BANDS.filter((b) => b.end > minY && b.start < maxY);
  const bands = active.length > 0 ? [...active] : [ERA_BANDS[ERA_BANDS.length - 1]];
  const n = bands.length;

  const segments: Segment[] = bands.map((b, i) => {
    const domainStart = Math.max(b.start, minY);
    const domainEnd = Math.min(b.end, maxY);
    const rangeStart = i / n;
    const rangeEnd = (i + 1) / n;
    const lo = domainStart < domainEnd ? domainStart : domainStart - 1;
    const hi = domainEnd > lo ? domainEnd : lo + 1;
    const scale = scaleLinear().domain([lo, hi]).range([rangeStart, rangeEnd]).clamp(true);
    return {
      domainStart: lo,
      domainEnd: hi,
      rangeStart,
      rangeEnd,
      scale: (y: number) => scale(y) as number,
    };
  });

  const domainStart = segments[0]!.domainStart;
  const domainEnd = segments[segments.length - 1]!.domainEnd;

  const toUnit = (year: number): number => {
    if (year <= domainStart) return 0;
    if (year >= domainEnd) return 1;
    for (const seg of segments) {
      if (year >= seg.domainStart && year <= seg.domainEnd) {
        return seg.scale(year);
      }
    }
    // Between segments (shouldn't happen with contiguous bands)
    const next = segments.find((s) => year < s.domainStart);
    return next ? next.rangeStart : 1;
  };

  const ticks: TimeScale["ticks"] = [];
  for (const seg of segments) {
    ticks.push({
      year: seg.domainStart,
      unit: toUnit(seg.domainStart),
      label: formatYear(seg.domainStart),
    });
  }
  ticks.push({
    year: domainEnd,
    unit: toUnit(domainEnd),
    label: formatYear(domainEnd),
  });

  const bandMeta = bands.map((b, i) => ({
    id: b.id,
    label: b.label,
    startUnit: i / n,
    endUnit: (i + 1) / n,
  }));

  return {
    toUnit,
    formatYear,
    ticks,
    bands: bandMeta,
    domainStart,
    domainEnd,
  };
}

export function unitStyle(
  startUnit: number,
  endUnit?: number,
): Record<string, string> {
  const s = Math.min(1, Math.max(0, startUnit));
  const e = endUnit == null ? s : Math.min(1, Math.max(s, endUnit));
  return {
    "--x-start": String(s),
    "--x-end": String(e),
  };
}

export function spanUnits(
  scale: TimeScale,
  startYear: number,
  endYear?: number,
): { start: number; end: number } {
  const start = scale.toUnit(startYear);
  const end = scale.toUnit(endYear ?? startYear);
  return { start, end: Math.max(start, end) };
}

export function eraOfYear(year: number): EraId {
  for (const b of ERA_BANDS) {
    if (year >= b.start && year < b.end) return b.id;
  }
  if (year < ERA_BANDS[0].start) return "ancient";
  return "post1950";
}
