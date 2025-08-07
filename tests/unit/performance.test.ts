import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  endMeasure,
  measure,
  measureAsync,
  startMeasure,
} from '../../src/lib/performance';

describe('Performance Monitoring', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  describe('startMeasure and endMeasure', () => {
    it('should measure duration between start and end', () => {
      startMeasure('test-operation');

      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // busy wait for 10ms
      }

      const duration = endMeasure('test-operation');
      expect(duration).toBeGreaterThan(9);
      expect(duration).toBeLessThan(50);
    });

    it('should return 0 for non-existent label', () => {
      const duration = endMeasure('non-existent');
      expect(duration).toBe(0);
    });

    it('should handle multiple concurrent measurements', () => {
      startMeasure('operation1');
      startMeasure('operation2');

      const duration1 = endMeasure('operation1');
      const duration2 = endMeasure('operation2');

      expect(duration1).toBeGreaterThanOrEqual(0);
      expect(duration2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('measure', () => {
    it('should measure synchronous function execution', () => {
      const result = measure('sync-operation', () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result).toBe(499_500);
      expect(stderrSpy).not.toHaveBeenCalled(); // Should be fast
    });

    it('should log slow operations over 100ms', () => {
      const result = measure('slow-operation', () => {
        const start = Date.now();
        while (Date.now() - start < 110) {
          // busy wait for 110ms
        }
        return 'done';
      });

      expect(result).toBe('done');
      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain(
        'Slow operation: slow-operation'
      );
    });

    it('should handle errors and clean up', () => {
      expect(() => {
        measure('error-operation', () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      // Should have cleaned up the mark
      const duration = endMeasure('error-operation');
      expect(duration).toBe(0);
    });
  });

  describe('measureAsync', () => {
    it('should measure async function execution', async () => {
      const result = await measureAsync('async-operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'async-done';
      });

      expect(result).toBe('async-done');
      expect(stderrSpy).not.toHaveBeenCalled(); // Should be under 100ms
    });

    it('should log slow async operations over 100ms', async () => {
      const result = await measureAsync('slow-async-operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 110));
        return 'slow-async-done';
      });

      expect(result).toBe('slow-async-done');
      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain(
        'Slow operation: slow-async-operation'
      );
    });

    it('should handle async errors and clean up', async () => {
      await expect(
        measureAsync('async-error-operation', async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error('Async test error');
        })
      ).rejects.toThrow('Async test error');

      // Should have cleaned up the mark
      const duration = endMeasure('async-error-operation');
      expect(duration).toBe(0);
    });

    it('should handle rejected promises', async () => {
      await expect(
        // biome-ignore lint/suspicious/useAwait: Testing rejected promise
        measureAsync('rejected-promise', async () => {
          return Promise.reject(new Error('Rejected'));
        })
      ).rejects.toThrow('Rejected');

      // Should have cleaned up the mark
      const duration = endMeasure('rejected-promise');
      expect(duration).toBe(0);
    });
  });
});
