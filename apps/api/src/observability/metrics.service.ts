import { Injectable } from '@nestjs/common';
import { Clock } from '../common/time/clock';

type Labels = Record<string, string>;

interface CounterSeries {
  labels: Labels;
  value: number;
}

interface HistogramSeries {
  labels: Labels;
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
}

export const HTTP_DURATION_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const;

/**
 * Small in-process Prometheus-compatible registry. This is deliberately not a
 * general metrics platform: it exposes bounded, low-cardinality series for
 * operational visibility without adding a dependency. Multi-replica
 * deployments need a proper scraper/aggregation layer.
 */
@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, Map<string, CounterSeries>>();
  private readonly histograms = new Map<string, Map<string, HistogramSeries>>();
  private readonly startedAt: number;

  constructor(private readonly clock: Clock) {
    this.startedAt = this.clock.now().getTime();
  }

  incrementCounter(name: string, labels: Labels = {}, amount = 1): void {
    if (!Number.isFinite(amount) || amount < 0) {
      return;
    }
    const series = this.counterSeries(name, labels);
    series.value += amount;
  }

  observeHistogram(name: string, value: number, labels: Labels = {}): void {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }
    const series = this.histogramSeries(name, labels);
    series.sum += value;
    series.count += 1;
    for (let index = 0; index < series.buckets.length; index += 1) {
      if (value <= series.buckets[index]) {
        series.counts[index] = (series.counts[index] ?? 0) + 1;
      }
    }
  }

  render(): string {
    const lines: string[] = [];
    const uptimeSeconds = (this.clock.now().getTime() - this.startedAt) / 1000;

    lines.push('# HELP nova_process_uptime_seconds Process uptime in seconds.');
    lines.push('# TYPE nova_process_uptime_seconds gauge');
    lines.push(`nova_process_uptime_seconds ${uptimeSeconds.toFixed(3)}`);

    lines.push('# HELP nova_process_node_info Node.js runtime information.');
    lines.push('# TYPE nova_process_node_info gauge');
    lines.push(`nova_process_node_info{version="${process.version.replace(/"/g, '')}"} 1`);

    for (const [name, family] of [...this.counters.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push(`# TYPE ${name} counter`);
      for (const series of family.values()) {
        lines.push(`${name}${formatLabels(series.labels)} ${series.value}`);
      }
    }

    for (const [name, family] of [...this.histograms.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push(`# TYPE ${name} histogram`);
      for (const series of family.values()) {
        for (let index = 0; index < series.buckets.length; index += 1) {
          const bucketLabels = { ...series.labels, le: String(series.buckets[index]) };
          lines.push(`${name}_bucket${formatLabels(bucketLabels)} ${series.counts[index] ?? 0}`);
        }
        lines.push(
          `${name}_bucket${formatLabels({ ...series.labels, le: '+Inf' })} ${series.count}`,
        );
        lines.push(`${name}_sum${formatLabels(series.labels)} ${series.sum}`);
        lines.push(`${name}_count${formatLabels(series.labels)} ${series.count}`);
      }
    }

    return `${lines.join('\n')}\n`;
  }

  private counterSeries(name: string, labels: Labels): CounterSeries {
    return this.seriesFor(this.counters, name, labels, () => ({
      labels: normalizeLabels(labels),
      value: 0,
    }));
  }

  private histogramSeries(name: string, labels: Labels): HistogramSeries {
    return this.seriesFor(this.histograms, name, labels, () => ({
      labels: normalizeLabels(labels),
      buckets: [...HTTP_DURATION_BUCKETS],
      counts: HTTP_DURATION_BUCKETS.map(() => 0),
      sum: 0,
      count: 0,
    }));
  }

  private seriesFor<T>(
    store: Map<string, Map<string, T>>,
    name: string,
    labels: Labels,
    create: () => T,
  ): T {
    const normalized = normalizeLabels(labels);
    const key = JSON.stringify(normalized);
    let family = store.get(name);
    if (family === undefined) {
      family = new Map<string, T>();
      store.set(name, family);
    }
    let series = family.get(key);
    if (series === undefined) {
      series = create();
      family.set(key, series);
    }
    return series;
  }
}

function normalizeLabels(labels: Labels): Labels {
  return Object.fromEntries(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));
}

function formatLabels(labels: Labels): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) {
    return '';
  }
  return `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(',')}}`;
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
