import { describe, it, expect } from 'vitest';
import { computePortOffset, resolvePort } from '../../src/utils/port-resolver.js';

describe('computePortOffset', () => {
  it('returns a number in valid range', () => {
    const offset = computePortOffset('my-app');
    expect(offset).toBeTypeOf('number');
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThan(200);
  });

  it('returns same offset for same name', () => {
    expect(computePortOffset('my-app')).toBe(computePortOffset('my-app'));
  });

  it('returns different offset for different names', () => {
    expect(computePortOffset('app-a')).not.toBe(computePortOffset('app-b'));
  });
});

describe('resolvePort', () => {
  it('returns explicit port as-is', () => {
    expect(resolvePort({ explicitPort: 9999, basePort: 8000, offset: 100 })).toBe(9999);
  });

  it('applies offset to base port when no explicit port', () => {
    expect(resolvePort({ explicitPort: null, basePort: 8000, offset: 100 })).toBe(8100);
  });
});
