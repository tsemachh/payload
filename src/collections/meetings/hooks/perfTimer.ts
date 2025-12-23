// -------- Performance helpers (scoped to this file) --------
// High-resolution timestamp in milliseconds
import { PayloadRequest } from 'payload'

const __nowMs = (): number => {
  // @ts-ignore - bigint is available in Node
  if (typeof process !== 'undefined' && process.hrtime && (process.hrtime as any).bigint) {
    // @ts-ignore
    return Number((process.hrtime as any).bigint() / BigInt(1e6))
  }
  return Date.now()
}

export class PerfTimer {
  private starts = new Map<string, number>()
  public durationsMs: Record<string, number> = {}
  public counts: Record<string, number> = {}

  start(label: string): void {
    this.starts.set(label, __nowMs())
  }

  end(label: string): number {
    const s = this.starts.get(label)
    const d = s ? __nowMs() - s : 0
    this.durationsMs[label] = (this.durationsMs[label] || 0) + d
    this.starts.delete(label)
    return d
  }

  inc(label: string, by = 1): void {
    this.counts[label] = (this.counts[label] || 0) + by
  }

  addDuration(label: string, ms: number): void {
    this.durationsMs[label] = (this.durationsMs[label] || 0) + ms
  }

  summary(): {
    durationsMs: Record<string, number>
    counts: Record<string, number>
    totalMs: number
  } {
    const totalMs = Object.values(this.durationsMs).reduce((a, b) => a + b, 0)
    return { durationsMs: this.durationsMs, counts: this.counts, totalMs }
  }
}

export function initPerformanceContext(req: PayloadRequest) {
  // perf toggle and thresholds
  const perfMode = String((req.context as any)?.perf ?? process.env.PERF_LOG ?? '').toLowerCase()
  const perfEnabled = perfMode === '1' || perfMode === 'true' || perfMode === 'verbose'
  const perfVerbose = perfMode === 'verbose'
  const slowThresholdMs = Number(process.env.PERF_SLOW_MS || '1000')

  const mt = new PerfTimer()
  return { perfEnabled, perfVerbose, slowThresholdMs, mt }
}
