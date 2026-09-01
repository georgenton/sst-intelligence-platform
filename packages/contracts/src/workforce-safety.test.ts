import { describe, expect, it } from 'vitest';
import { assertWorkerDateRange, canReceiveNewWorkerAssignment } from './workforce-safety.js';

describe('worker registry rules', () => {
  it('allows new assignments only for active workers', () => {
    expect(canReceiveNewWorkerAssignment('ACTIVE')).toBe(true);
    expect(canReceiveNewWorkerAssignment('INACTIVE')).toBe(false);
  });

  it('rejects an end date before the start date', () => {
    expect(() => assertWorkerDateRange(new Date('2026-08-10'), new Date('2026-08-09'))).toThrow(
      RangeError,
    );
    expect(() =>
      assertWorkerDateRange(new Date('2026-08-10'), new Date('2026-08-10')),
    ).not.toThrow();
  });
});
