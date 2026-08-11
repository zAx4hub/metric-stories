import { describe, it, expect } from "vitest";
import { zScore, detectSpikes, run, demo, inspect } from "../src/engine";

describe("metric-stories", () => {
  it("zScore", () => {
    expect(zScore([1, 1, 1, 1], 10)).toBeGreaterThan(2);
  });
  it("detectSpikes", () => {
    const spikes = detectSpikes([
      { ts: 1, name: "e", value: 1 },
      { ts: 2, name: "e", value: 1 },
      { ts: 3, name: "e", value: 20 },
    ], 1.2);
    expect(spikes.some((s) => s.value === 20)).toBe(true);
  });
  it("run builds stories", () => {
    const r = run({});
    expect(r.findings.length).toBeGreaterThan(0);
    expect(r.findings[0].narrative.length).toBeGreaterThan(10);
    expect(r.author).toContain("zAx4hub");
  });
  it("demo + inspect", () => {
    expect(demo().metrics.spikes).toBeGreaterThan(0);
    expect(inspect().features).toContain("narrative");
  });
});
