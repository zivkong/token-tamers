import { describe, expect, it } from 'vitest';
import { decodeDna, encodeDna, type DexSnapshot, type Grade, type Stage } from '../src/index';

function snap(over: Partial<DexSnapshot> = {}): DexSnapshot {
  return {
    speciesId: 'aurelion',
    stage: 'prime',
    grade: 'A',
    stats: { pwr: 72, spd: 91, wis: 64, grt: 80 },
    house: 'aether',
    traits: ['marathoner', 'nightshade'],
    pattern: 'vigil',
    rhythmVariant: 'nocturne',
    mutations: ['palette-shift'],
    generation: 6,
    contentVersion: 1,
    recordedAt: 5000,
    reason: 'rebirth',
    ...over,
  };
}

describe('DNA codec', () => {
  it('round-trips all encoded fields', () => {
    const s = snap();
    const d = decodeDna(encodeDna(s, { speciesNum: 14 }));
    expect(d.sigValid).toBe(true);
    expect(d.speciesNum).toBe(14);
    expect(d.contentMin).toBe(1);
    expect(d.grade).toBe('A');
    expect(d.stage).toBe('prime');
    expect(d.house).toBe('aether');
    expect(d.stats).toEqual(s.stats);
    expect(d.traits).toEqual(s.traits);
    expect(d.pattern).toBe('vigil');
    expect(d.rhythmVariant).toBe('nocturne');
    expect(d.mutations).toEqual(s.mutations);
    expect(d.generation).toBe(6);
    expect(d.unknown).toEqual({ traits: [], mutations: [] });
  });

  it('round-trips every grade × stage with null pattern/rhythm', () => {
    const grades: Grade[] = ['C', 'B', 'A', 'S'];
    const stages: Stage[] = ['egg', 'sprite', 'rookie', 'evolved', 'prime', 'apex'];
    for (const grade of grades) {
      for (const stage of stages) {
        const s = snap({
          grade,
          stage,
          pattern: null,
          rhythmVariant: null,
          traits: [],
          mutations: [],
        });
        const d = decodeDna(encodeDna(s, { speciesNum: 3 }));
        expect(d.sigValid).toBe(true);
        expect(d.grade).toBe(grade);
        expect(d.stage).toBe(stage);
        expect(d.pattern).toBeNull();
        expect(d.rhythmVariant).toBeNull();
      }
    }
  });

  it('emits an opaque license-key token (TTX<v>-XXXX-…)', () => {
    expect(encodeDna(snap(), { speciesNum: 14 })).toMatch(/^TTX1(-[0-9A-Z]+)+$/);
  });

  it('whitening avalanches — a one-field change rewrites most of the body', () => {
    const a = encodeDna(snap({ generation: 6 }), { speciesNum: 14 }).replace(/[^0-9A-Z]/g, '');
    const b = encodeDna(snap({ generation: 7 }), { speciesNum: 14 }).replace(/[^0-9A-Z]/g, '');
    let same = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) same++;
    // A whitened token diffuses a single-field change; the bodies should barely overlap.
    expect(same).toBeLessThan(Math.min(a.length, b.length) * 0.5);
  });

  it('is deterministic (byte-identical on repeat)', () => {
    expect(encodeDna(snap(), { speciesNum: 14 })).toBe(encodeDna(snap(), { speciesNum: 14 }));
  });

  it('locks the byte layout forever (golden codes — never edit, only append)', () => {
    expect(encodeDna(snap({ grade: 'S' }), { speciesNum: 14 })).toMatchSnapshot();
    expect(
      encodeDna(
        snap({
          grade: 'C',
          stage: 'sprite',
          traits: [],
          mutations: [],
          pattern: null,
          rhythmVariant: null,
          house: 'wild',
          stats: { pwr: 1, spd: 2, wis: 3, grt: 4 },
          generation: 1,
        }),
        { speciesNum: 1 },
      ),
    ).toMatchSnapshot();
  });

  it('detects tampering via the integrity tag without throwing', () => {
    const code = encodeDna(snap(), { speciesNum: 14 });
    // Flip the first body char (just after the `TTX1-` prefix) to a different symbol.
    const ch = code[5] === 'A' ? 'B' : 'A';
    const d = decodeDna(code.slice(0, 5) + ch + code.slice(6));
    expect(d.sigValid).toBe(false);
    expect(typeof d.speciesNum).toBe('number');
  });

  it('never rejects garbage — returns defaults with sigValid false', () => {
    const d = decodeDna('not-a-real-code');
    expect(d.sigValid).toBe(false);
    expect(d.grade).toBe('C');
    expect(d.stage).toBe('egg');
  });

  it('tolerates unknown trailing data — recovers leading fields, never throws', () => {
    // A newer code may carry extra trailing groups (reserved extension area);
    // the stable keystream prefix keeps the known leading fields decodable.
    const future = encodeDna(snap(), { speciesNum: 14 }) + '-ABCD';
    expect(() => decodeDna(future)).not.toThrow();
    const d = decodeDna(future);
    expect(d.schema).toBe(1);
    expect(d.speciesNum).toBe(14);
    expect(d.grade).toBe('A');
    expect(d.house).toBe('aether');
  });

  describe('tamer maker’s-mark (reserved ext area)', () => {
    it('round-trips the tamer handle and title alongside every field', () => {
      const code = encodeDna(snap(), { speciesNum: 14, tamer: 'Vela', title: 'Apex Tamer' });
      const d = decodeDna(code);
      expect(d.sigValid).toBe(true);
      expect(d.tamer).toBe('Vela');
      expect(d.title).toBe('Apex Tamer');
      // The pet fields still decode unchanged with a mark present.
      expect(d.grade).toBe('A');
      expect(d.stats).toEqual(snap().stats);
    });

    it('omitting the tamer is byte-identical to an empty tamer (no ext data)', () => {
      const bare = encodeDna(snap(), { speciesNum: 14 });
      const empty = encodeDna(snap(), { speciesNum: 14, tamer: '', title: '' });
      expect(empty).toBe(bare);
      const d = decodeDna(bare);
      expect(d.tamer).toBe('');
      expect(d.title).toBe('');
    });

    it('sanitizes + caps the handle (printable ASCII, ≤ 16 chars)', () => {
      const d = decodeDna(
        encodeDna(snap(), {
          speciesNum: 14,
          tamer: '  Drako 🐉 the Boundless Wanderer  ',
        }),
      );
      // Non-ASCII stripped, leading space trimmed, capped to 16 chars.
      expect(d.tamer.length).toBeLessThanOrEqual(16);
      expect(d.tamer).toMatch(/^[\x20-\x7e]+$/);
      expect(d.tamer.startsWith('Drako')).toBe(true);
      expect(d.tamer).not.toContain('🐉');
    });

    it('still detects tampering when a mark is present, and never throws', () => {
      const code = encodeDna(snap(), { speciesNum: 14, tamer: 'Vela' });
      const ch = code[5] === 'A' ? 'B' : 'A';
      expect(() => decodeDna(code.slice(0, 5) + ch + code.slice(6))).not.toThrow();
      expect(decodeDna(code.slice(0, 5) + ch + code.slice(6)).sigValid).toBe(false);
    });

    it('locks the byte layout of a tamer-stamped code (golden — append only)', () => {
      expect(
        encodeDna(snap({ grade: 'S' }), { speciesNum: 14, tamer: 'Vela', title: 'Apex Tamer' }),
      ).toMatchSnapshot();
    });
  });
});
