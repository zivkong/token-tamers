import { describe, it, expect } from 'vitest';
import type { ContentPack, SpeciesDef } from '@token-tamers/core';
import { buildHouseNodes, houseNodeCount, DEX_HOUSES, type HouseNode } from '../src/pages/dex';
import { renderFocusRail } from '../src/pages/dex-sky';
import { FrameBuffer } from '../src/render/buffer';
import { HitRegistry } from '../src/render/hit';
import { StringSink, Writer } from '../src/terminal/ansi';
import { handleEvent } from '../src/shell-input';
import type { InputDeps, ShellHost, ShellRuntime } from '../src/shell';
import type { RenderContext } from '../src/pages/types';
import { makePack, makeState } from './fixtures';

/** A 3-tier Aether line (sprite → rookie → evolved) for navigation tests. */
function threeTierPack(): ContentPack {
  const base = {
    house: 'aether' as const,
    statWeights: { pwr: 1, spd: 1, wis: 1, grt: 1 },
    spriteId: 'spr_wisp',
  };
  const species: SpeciesDef[] = [
    {
      ...base,
      id: 'a1',
      num: 1,
      name: 'Spritelet',
      stage: 'sprite',
      evolvesTo: [{ species: 'a2', when: { kind: 'default' } }],
    },
    {
      ...base,
      id: 'a2',
      num: 2,
      name: 'Rooklet',
      stage: 'rookie',
      evolvesTo: [{ species: 'a3', when: { kind: 'default' } }],
    },
    { ...base, id: 'a3', num: 3, name: 'Volved', stage: 'evolved', evolvesTo: [] },
  ];
  return { ...makePack(), species };
}

function ctxOf(pack: ContentPack, state = makeState()): RenderContext {
  return { pack, state } as unknown as RenderContext;
}

describe('dex constellation node model', () => {
  it('marks owned/unseen stars, roots at the Mote, and counts the roster', () => {
    const ctx = ctxOf(makePack());
    const aether = buildHouseNodes(ctx, DEX_HOUSES.indexOf('aether'));
    // Every sky begins at the shared Mote (tier 0, first) then the House's stars.
    expect(aether[0]!.stage).toBe('egg');
    expect(aether.find((n) => n.speciesId === 'wisp')).toMatchObject({ owned: true, grade: 'C' });

    const forgeIdx = DEX_HOUSES.indexOf('forge');
    const forge = buildHouseNodes(ctx, forgeIdx);
    expect(forge.find((n) => n.speciesId === 'ember')).toMatchObject({ owned: false, grade: null });
    expect(houseNodeCount(ctx, forgeIdx)).toBe(2); // Mote + Ember
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
    // Tier asc: Mote (egg) → sprite → rookie.
    expect(nodes.map((n) => n.speciesId)).toEqual(['mote', 'a1', 'a2']);
    expect(nodes.find((n) => n.speciesId === 'a2')!.parents).toEqual(['a1']);
    expect(nodes.find((n) => n.speciesId === 'a1')!.parents).toEqual(['mote']); // sprite ← Mote
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
      // The focus rail bounds its text to the page body (pageBodyBottom), so a
      // realistic layout is required — mirrors what the shell always provides.
      layout: { canvasX: 4, canvasY: 0, canvasCols: 38, canvasRows: 22 },
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

  it('navigates ↑ toward the apex and ↓ toward the sprite (screen-aligned)', () => {
    const aether = DEX_HOUSES.indexOf('aether');
    const host = { pack: threeTierPack(), getState: () => makeState() } as unknown as ShellHost;
    const rt = {
      page: 'dex',
      battle: undefined,
      ui: { dex: { selected: 0, scroll: 0, house: aether } },
    } as unknown as ShellRuntime;
    const deps = { host, hits: new HitRegistry(), copy: () => {} } as unknown as InputDeps;
    // Nodes order sprite(0) → rookie(1) → evolved(2); the sky draws apex at the top.
    handleEvent(rt, { type: 'key', name: 'up' }, deps);
    expect(rt.ui.dex.selected).toBe(1); // ↑ climbs the index toward the apex
    handleEvent(rt, { type: 'key', name: 'up' }, deps);
    expect(rt.ui.dex.selected).toBe(2);
    handleEvent(rt, { type: 'key', name: 'down' }, deps);
    expect(rt.ui.dex.selected).toBe(1); // ↓ descends toward the sprite/Mote
  });
});
