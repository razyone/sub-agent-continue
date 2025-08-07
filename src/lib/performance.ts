import { performance } from 'node:perf_hooks';

const marks = new Map<string, number>();

export function startMeasure(label: string): void {
  marks.set(label, performance.now());
}

export function endMeasure(label: string): number {
  const startTime = marks.get(label);
  if (!startTime) {
    return 0;
  }
  const duration = performance.now() - startTime;
  marks.delete(label);
  return duration;
}

export function measure<T>(label: string, fn: () => T): T {
  startMeasure(label);
  try {
    const result = fn();
    const duration = endMeasure(label);
    if (duration > 100) {
      // Log slow operations (over 100ms)
      process.stderr.write(
        `⚠️  Slow operation: ${label} took ${duration.toFixed(2)}ms\n`
      );
    }
    return result;
  } catch (error) {
    marks.delete(label);
    throw error;
  }
}

export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  startMeasure(label);
  try {
    const result = await fn();
    const duration = endMeasure(label);
    if (duration > 100) {
      // Log slow operations (over 100ms)
      process.stderr.write(
        `⚠️  Slow operation: ${label} took ${duration.toFixed(2)}ms\n`
      );
    }
    return result;
  } catch (error) {
    marks.delete(label);
    throw error;
  }
}
