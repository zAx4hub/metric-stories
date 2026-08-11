/** metric-stories — incident narratives by zAx4hub */
export type Point = { ts: number; name: string; value: number };
export type LogLine = { ts: number; level: string; msg: string };
export type Deploy = { ts: number; version: string; service: string };
export type Story = {
  id: string;
  title: string;
  severity: "sev1" | "sev2" | "sev3";
  timeline: string[];
  suspects: string[];
  score: number;
  narrative: string;
};

export type Report = {
  project: string;
  author: string;
  summary: string;
  score: number;
  findings: Story[];
  metrics: Record<string, number>;
};

export function zScore(values: number[], v: number): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance) || 1;
  return (v - mean) / sd;
}

export function detectSpikes(points: Point[], threshold = 2.5): Point[] {
  const byName = new Map<string, number[]>();
  for (const p of points) {
    if (!byName.has(p.name)) byName.set(p.name, []);
    byName.get(p.name)!.push(p.value);
  }
  return points.filter((p) => zScore(byName.get(p.name)!, p.value) >= threshold);
}

export function correlate(spikes: Point[], deploys: Deploy[], logs: LogLine[], windowMs = 15 * 60 * 1000): Story[] {
  const stories: Story[] = [];
  for (const spike of spikes) {
    const nearDeploys = deploys.filter((d) => Math.abs(d.ts - spike.ts) <= windowMs);
    const nearLogs = logs.filter((l) => Math.abs(l.ts - spike.ts) <= windowMs && /error|timeout|exception|5\d\d/.test(l.msg + l.level));
    const severity: Story["severity"] = spike.value > 0 && zish(spike) > 4 ? "sev1" : nearLogs.length > 2 ? "sev2" : "sev3";
    const suspects = [
      ...nearDeploys.map((d) => `deploy:${d.service}@${d.version}`),
      ...nearLogs.slice(0, 3).map((l) => `log:${l.msg.slice(0, 60)}`),
    ];
    const timeline = [
      new Date(spike.ts).toISOString() + ` spike ${spike.name}=${spike.value}`,
      ...nearDeploys.map((d) => new Date(d.ts).toISOString() + ` deploy ${d.version}`),
      ...nearLogs.slice(0, 2).map((l) => new Date(l.ts).toISOString() + ` ${l.level}: ${l.msg}`),
    ];
    const narrative = suspects.length
      ? `${spike.name} spiked to ${spike.value}. Likely related: ${suspects.join("; ")}.`
      : `${spike.name} spiked to ${spike.value} with no nearby deploy/log correlation.`;
    stories.push({
      id: `story-${spike.name}-${spike.ts}`,
      title: `${spike.name} anomaly`,
      severity,
      timeline,
      suspects,
      score: Math.min(1, 0.4 + suspects.length * 0.15),
      narrative,
    });
  }
  return stories;
}

function zish(p: Point): number {
  return Math.abs(p.value) / 100;
}

export function run(input: { metrics?: Point[]; logs?: LogLine[]; deploys?: Deploy[] } = {}): Report {
  const metrics =
    input.metrics ??
    [
      { ts: 1_700_000_000_000, name: "error_rate", value: 0.2 },
      { ts: 1_700_000_060_000, name: "error_rate", value: 0.25 },
      { ts: 1_700_000_120_000, name: "error_rate", value: 18.5 },
      { ts: 1_700_000_000_000, name: "p99_ms", value: 120 },
      { ts: 1_700_000_060_000, name: "p99_ms", value: 130 },
      { ts: 1_700_000_120_000, name: "p99_ms", value: 2200 },
    ];
  const deploys = input.deploys ?? [{ ts: 1_700_000_100_000, version: "1.4.2", service: "api" }];
  const logs =
    input.logs ??
    [
      { ts: 1_700_000_110_000, level: "error", msg: "upstream timeout 504" },
      { ts: 1_700_000_115_000, level: "error", msg: "exception in checkout" },
    ];
  const spikes = detectSpikes(metrics, 1.1);
  const findings = correlate(spikes, deploys, logs);
  const score = findings.length ? Math.round((findings.reduce((a, f) => a + f.score, 0) / findings.length) * 1000) / 1000 : 0;
  return {
    project: "metric-stories",
    author: "zAx4hub",
    summary: `Spikes=${spikes.length}; stories=${findings.length}`,
    score,
    findings,
    metrics: { spikes: spikes.length, stories: findings.length, sev1: findings.filter((f) => f.severity === "sev1").length },
  };
}

export function demo(): Report {
  return run({});
}

export function inspect() {
  return {
    name: "metric-stories",
    author: "zAx4hub",
    oneLiner: "Incident stories from metrics/logs/deploys",
    features: ["zscore", "spikes", "deploy-correlate", "log-correlate", "narrative"],
    version: "0.1.0",
    commands: ["demo", "run", "inspect"],
  };
}
