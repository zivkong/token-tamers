import { describe, it, expect } from 'vitest';
import { bgSgr, fgSgr, hexToRgb, rgbTo256, rgbTo8 } from '../src/terminal/ansi';

const E = '\x1b';

describe('color degradation', () => {
  const red = { r: 255, g: 0, b: 0 };

  it('truecolor emits 24-bit SGR', () => {
    expect(fgSgr(red, 'truecolor')).toBe(`${E}[38;2;255;0;0m`);
    expect(bgSgr(red, 'truecolor')).toBe(`${E}[48;2;255;0;0m`);
  });

  it('256 maps to the 6x6x6 cube', () => {
    const idx = rgbTo256(red);
    expect(idx).toBeGreaterThanOrEqual(16);
    expect(idx).toBeLessThanOrEqual(231);
    expect(fgSgr(red, '256')).toBe(`${E}[38;5;${idx}m`);
  });

  it('grayscale uses the gray ramp', () => {
    const gray = rgbTo256({ r: 128, g: 128, b: 128 });
    expect(gray).toBeGreaterThanOrEqual(232);
    expect(gray).toBeLessThanOrEqual(255);
  });

  it('8-color maps red to ANSI 1', () => {
    expect(rgbTo8(red)).toBe(1);
    expect(fgSgr(red, '8')).toBe(`${E}[31m`);
  });

  it('none mode emits no color', () => {
    expect(fgSgr(red, 'none')).toBe('');
    expect(bgSgr(red, 'none')).toBe('');
  });

  it('parses hex tints (long, short, with/without hash)', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
  });
});
