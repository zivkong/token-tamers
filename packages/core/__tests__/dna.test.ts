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

  it('emits the documented TT<schema>-c<rev>-<payload>-<sig> shape', () => {
    expect(encodeDna(snap(), { speciesNum: 14 })).toMatch(/^TT2-c1-[0-9A-Z]+-[0-9A-Z]+$/);
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

  it('detects tampering via the signature but still recovers fields', () => {
    const parts = encodeDna(snap(), { speciesNum: 14 }).split('-');
    const payload = parts[2]!;
    const flipped = (payload[0] === '0' ? '1' : '0') + payload.slice(1);
    const d = decodeDna(`TT2-c1-${flipped}-${parts[3]}`);
    expect(d.sigValid).toBe(false);
    expect(typeof d.speciesNum).toBe('number');
  });

  it('never rejects garbage — returns defaults with sigValid false', () => {
    const d = decodeDna('not-a-real-code');
    expect(d.sigValid).toBe(false);
    expect(d.grade).toBe('C');
    expect(d.stage).toBe('egg');
  });

  it('parses a newer-schema header without throwing, recovering known fields', () => {
    const future = encodeDna(snap(), { speciesNum: 14 }).replace(/^TT2-/, 'TT9-');
    const d = decodeDna(future);
    expect(d.schema).toBe(9);
    expect(d.speciesNum).toBe(14);
    expect(d.grade).toBe('A');
    expect(d.house).toBe('aether');
  });
});
