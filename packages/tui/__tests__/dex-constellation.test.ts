import { describe, it, expect } from 'vitest';
import type { ContentPack, SpeciesDef } from '@token-tamers/core';
import { buildHouseNodes, houseNodeCount, DEX_HOUSES, type HouseNode } from '../src/pages/dex';
import { renderFocusRail } from '../src/pages/dex-sky';
import { FrameBuffer } from '../src/render/buffer';
import { HitRegistry } from '../src/render/hit';
import { StringSink, Writer } from '../src/terminal/ansi';
import type { RenderContext } from '../src/pages/types';
import { makePack, makeState } from './fixtures';

function ctxOf(pack: ContentPack, state = makeState()): RenderContext {
  return { pack, state } as unknown as RenderContext;
}

describe('dex constellation node model', () => {
  it('marks owned/unseen stars and counts the House roster', () => {
    const ctx = ctxOf(makePack());
    const aether = buildHouseNodes(ctx, DEX_HOUSES.indexOf('aether'));
    expect(aether).toHaveLength(1);
    expect(aether[0]).toMatchObject({ speciesId: 'wisp', owned: true, grade: 'C' });

    const forgeIdx = DEX_HOUSES.indexOf('forge');
    const forge = buildHouseNodes(ctx, forgeIdx);
    expect(forge[0]).toMatchObject({ speciesId: 'ember', owned: false, grade: null });
    expect(houseNodeCount(ctx, forgeIdx)).toBe(1);
  });

  it('orders stars by tier and links in-House parents', () => {
    const sprite: SpeciesDef = {
      id: 'a1',
      num: 1,
      name: 'Alpha',
      house: 'aether',
      stage: 'sprite',
      statWeights: { pwr: 1, spd: 1, wis: 1, grt: 1 },
      evolvesTo: [{ species: 'a2', when: { kind: 'default' } }],
      spriteId: 'spr_wisp',
    };
    const rookie: SpeciesDef = {
      ...sprite,
      id: 'a2',
      num: 2,
      name: 'Beta',
      stage: 'rookie',
      evolvesTo: [],
    };
    const pack = { ...makePack(), species: [rookie, sprite] }; // deliberately out of order
    const nodes = buildHouseNodes(ctxOf(pack), DEX_HOUSES.indexOf('aether'));
    expect(nodes.map((n) => n.speciesId)).toEqual(['a1', 'a2']); // tier asc: sprite then rookie
    expect(nodes[1]!.parents).toEqual(['a1']);
  });

  it('renders the ornate gold tile for a legend slot', () => {
    const buf = new FrameBuffer(40, 22);
    const sink = new StringSink();
    const ctx = {
      buf,
      hits: new HitRegistry(),
      pack: makePack(),
      state: makeState(),
      mode: 'none',
      frame: 0,
    } as unknown as RenderContext;
    const legend: HouseNode = {
      speciesId: 'secret',
      name: '???',
      num: 99,
      stage: 'apex',
      tier: 5,
      owned: false,
      grade: null,
      legend: true,
      parents: [],
    };
    renderFocusRail(ctx, { x: 4, y: 0, w: 34, h: 22 }, legend, 'aether');
    const out = buf.flush(new Writer(sink, 'none'));
    expect(out).toContain('✦'); // gold aura / marker
    expect(out).toContain('???');
  });
});
