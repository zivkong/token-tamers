import { describe, it, expect } from 'vitest';
import { HitRegistry } from '../src/hit';

describe('HitRegistry', () => {
  it('resolves a click inside a region', () => {
    const reg = new HitRegistry();
    reg.add('a', 2, 2, 5, 1);
    expect(reg.hit(2, 2)).toBe('a');
    expect(reg.hit(6, 2)).toBe('a');
    expect(reg.hit(7, 2)).toBeNull();
    expect(reg.hit(2, 3)).toBeNull();
  });

  it('topmost (last added) region wins on overlap', () => {
    const reg = new HitRegistry();
    reg.add('bottom', 0, 0, 10, 10);
    reg.add('top', 2, 2, 4, 4);
    expect(reg.hit(3, 3)).toBe('top');
    expect(reg.hit(0, 0)).toBe('bottom');
  });

  it('reset clears regions each frame', () => {
    const reg = new HitRegistry();
    reg.add('a', 0, 0, 5, 5);
    reg.reset();
    expect(reg.hit(0, 0)).toBeNull();
    expect(reg.list()).toHaveLength(0);
  });
});
