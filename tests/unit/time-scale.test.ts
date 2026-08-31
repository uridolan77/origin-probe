import { describe, expect, it } from "vitest";
import {
  buildTimeScale,
  compareYears,
  formatYear,
  eraOfYear,
} from "@/lib/time-scale";

describe("time-scale", () => {
  it("formats BCE years", () => {
    expect(formatYear(-500)).toBe("500 BCE");
    expect(formatYear(1964)).toBe("1964");
  });

  it("compares years numerically including BCE", () => {
    expect(compareYears(-500, -100)).toBeLessThan(0);
    expect(compareYears(-100, 100)).toBeLessThan(0);
    expect(compareYears(1964, 1980)).toBeLessThan(0);
  });

  it("maps BCE and CE onto a shared unit interval", () => {
    const scale = buildTimeScale([-500, 1964, 2012]);
    const a = scale.toUnit(-500);
    const b = scale.toUnit(1964);
    const c = scale.toUnit(2012);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThanOrEqual(1);
  });

  it("assigns era bands", () => {
    expect(eraOfYear(-400)).toBe("ancient");
    expect(eraOfYear(1200)).toBe("medieval");
    expect(eraOfYear(2000)).toBe("post1950");
  });
});
