/**
 * The interactive shell: a 30fps fixed-timestep loop that renders the active
 * page into the canvas, draws a clickable menu grid below it, and drives the
 * host's simulation about once per second.
 *
 * All wall-clock reads go through a single injected `now()` so golden tests can
 * fake time. All terminal output goes through one `Writer`.
 */

import { Writer, type ColorMode, type OutputSink } from './terminal/ansi';
import { FrameBuffer } from './render/buffer';
import { HitRegistry } from './render/hit';
import type { InputEvent } from './terminal/input';
import { defaultSize, enterTerminal, nullSource, sleep, stdinSource, stdoutSink } from './shell-io';
import { renderFrame, type FrameInput } from './render/frame';
import type {
  AdapterInfo,
  BattleView,
  CompletionBreakdown,
  LiveStats,
  PageId,
  PageUiState,
  ShellInfo,
  SettingsState,
} from './pages/types';
import { advanceBattlePlayback } from './pages/battle';
import { applyEffects } from './shell-effects';
import { handleEvent } from './shell-input';
import type { ContentPack, GameEffect, GameState } from '@token-tamers/core';

// Re-exported shell host/options contract (kept identical to src/index.ts).
export interface ShellHost {
  pack: ContentPack;
  getState(): GameState;
  advance(now: number): GameEffect[];
  completion(): CompletionBreakdown;
  /**
   * Optional real-time token-consumption readout for the pet vitals panel,
   * derived from the engine's open window. Called once per rendered frame.
   */
  liveStats?(): LiveStats;
}

export interface ShellOptions {
  host: ShellHost;
  fps?: number;
  color?: ColorMode;
  /** Static build/config facts surfaced on the Settings page. */
  info?: ShellInfo;
  /** Configured adapters (read-only display on the Settings page). */
  adapters?: AdapterInfo[];
  /** Initial pet-global cycle policy ('subscription' | 'static'); defaults to 'static'. */
  cyclePolicy?: string;
  /** Initial subscription anchor adapter id; '' when static. */
  anchorAdapter?: string;
  /** Initial opt-in update mode ('off' | 'notify' | 'auto'); defaults to 'off'. */
  updateMode?: string;
  /** Initial page to open on; defaults to 'pet'. `tt battle` opens on 'battle'. */
  initialPage?: PageId;
  /** A battle to play back immediately (set by `tt battle <code>`); undefined ⇒ picker. */
  initialBattle?: BattleView;
  /**
   * Persist the edited pet-global cycle clock. Called on each change with the new
   * policy + anchor; the host writes config.json (applied on next launch).
   */
  onCycleChange?: (policy: string, anchorAdapter: string) => void;
  /**
   * Persist the edited opt-in update mode. Called with the new mode; the host
   * writes settings.json (applied on next launch). Off by default — the offline
   * pledge holds until the player opts in here.
   */
  onUpdateModeChange?: (mode: string) => void;
  // --- additive testing/IO hooks (all optional; defaults wire real stdio) ---
  /** Injected clock; defaults to Date.now. Single time source for the loop. */
  now?: () => number;
  /** Output sink; defaults to a process.stdout-backed sink. */
  out?: OutputSink;
  /** Async source of decoded input events; defaults to process.stdin. */
  input?: InputSource;
  /** Terminal size source; defaults to process.stdout columns/rows. */
  size?: () => { cols: number; rows: number };
  /** Install signal/raw-mode handlers; defaults true. Tests pass false. */
  manageTerminal?: boolean;
  /** Stop after this many frames (tests); undefined = run until quit. */
  maxFrames?: number;
}

/** A pull/push source of input events. */
export interface InputSource {
  /** Register a listener; returns an unsubscribe fn. */
  onEvent(cb: (ev: InputEvent) => void): () => void;
  start?(): void;
  stop?(): void;
}

const FRAME_MS = 1000 / 30;
const ADVANCE_MS = 1000;

/** Mutable shell runtime. Exported for the input handlers in `shell-input.ts`. */
export interface ShellRuntime {
  page: PageId;
  frame: number;
  ui: Record<PageId, PageUiState>;
  flash: string | null;
  flashUntilFrame: number;
  quit: boolean;
  /** Static build/config facts for the Settings page (from options). */
  info?: ShellInfo;
  /** Live, editable adapter state for the Settings page. */
  settings: SettingsState;
  /** Persist hook for the pet-global cycle edit (from options). */
  onCycleChange?: (policy: string, anchorAdapter: string) => void;
  /** Persist hook for the opt-in update-mode edit (from options). */
  onUpdateModeChange?: (mode: string) => void;
  /** The loaded battle to play back on the Battle page (undefined ⇒ opponent picker). */
  battle?: BattleView;
}

/** Resolved loop dependencies (injected once, passed as a unit). */
interface LoopContext {
  options: ShellOptions;
  writer: Writer;
  sizeFn: () => { cols: number; rows: number };
  now: () => number;
  frameMs: number;
  /** The hit registry, shared with the input handler so clicks resolve page regions. */
  hits: HitRegistry;
}

/** Dependencies the input handler needs beyond the runtime. Exported for `shell-input.ts`. */
export interface InputDeps {
  host: ShellHost;
  /** Last frame's hit regions (pages register clickable ids during render). */
  hits: HitRegistry;
  /** Copy text to the terminal clipboard (OSC 52). */
  copy: (text: string) => void;
}

function freshUi(): Record<PageId, PageUiState> {
  return {
    pet: { selected: 0, scroll: 0 },
    dex: { selected: 0, scroll: 0 },
    'dex-detail': { selected: 0, scroll: 0, speciesId: null },
    archive: { selected: 0, scroll: 0 },
    settings: { selected: 0, scroll: 0 },
    battle: { selected: 0, scroll: 0 },
  };
}

/**
 * Seed the editable Settings state from a working copy of the adapter configs +
 * the opt-in update mode. The update-mode field is always present (index 0), so
 * `selected` starts there and the page is editable even with no adapters.
 */
function initialSettings(options: ShellOptions): SettingsState {
  const copy = (options.adapters ?? []).map((a) => ({ ...a }));
  return {
    updateMode: options.updateMode ?? 'off',
    cyclePolicy: options.cyclePolicy ?? 'static',
    anchorAdapter: options.anchorAdapter ?? '',
    adapters: copy,
    selected: 0,
  };
}

/**
 * Run the shell. Resolves on quit (key 'q', the Quit menu, or ctrl-c). The
 * fixed-timestep accumulator decouples sim/render cadence from real frame jitter.
 */
export async function runShell(options: ShellOptions): Promise<void> {
  const fps = options.fps ?? 30;
  const frameMs = 1000 / fps;
  const color: ColorMode = options.color ?? 'truecolor';
  const now = options.now ?? Date.now;
  const manageTerminal = options.manageTerminal ?? true;

  const sink: OutputSink = options.out ?? stdoutSink();
  const writer = new Writer(sink, color);
  const sizeFn = options.size ?? defaultSize;

  const rt: ShellRuntime = {
    page: options.initialPage ?? 'pet',
    frame: 0,
    ui: freshUi(),
    flash: null,
    flashUntilFrame: 0,
    quit: false,
    info: options.info,
    settings: initialSettings(options),
    onCycleChange: options.onCycleChange,
    onUpdateModeChange: options.onUpdateModeChange,
    battle: options.initialBattle,
  };

  // Shared with the loop's renderer so a click resolves the regions pages drew.
  const hits = new HitRegistry();
  const deps: InputDeps = {
    host: options.host,
    hits,
    copy: (text) => writer.copyToClipboard(text),
  };

  const inputSource = options.input ?? (manageTerminal ? stdinSource() : nullSource());
  const unsubscribe = inputSource.onEvent((ev) => handleEvent(rt, ev, deps));

  const cleanup = manageTerminal ? enterTerminal(writer) : () => {};

  try {
    inputSource.start?.();
    const ctx: LoopContext = { options, writer, sizeFn, now, frameMs, hits };
    await loop(rt, ctx);
  } finally {
    unsubscribe();
    inputSource.stop?.();
    cleanup();
    writer.restore();
  }
}

async function loop(rt: ShellRuntime, ctx: LoopContext): Promise<void> {
  const { options, writer, sizeFn, now, frameMs, hits } = ctx;
  const host = options.host;
  let last = now();
  let renderAcc = 0;
  let advanceAcc = 0;
  let frames = 0;

  let curSize = sizeFn();
  // Force a full first paint with a fresh buffer.
  let buf = new FrameBuffer(curSize.cols, curSize.rows);

  while (!rt.quit) {
    const t = now();
    const dt = Math.max(0, t - last);
    last = t;
    renderAcc += dt;
    advanceAcc += dt;

    // Advance the sim ~1/sec.
    while (advanceAcc >= ADVANCE_MS) {
      const effects = host.advance(now());
      applyEffects(rt, effects);
      advanceAcc -= ADVANCE_MS;
    }

    // Render at the fixed frame cadence (catch up, but cap to avoid spirals).
    let steps = 0;
    while (renderAcc >= frameMs && steps < 5) {
      // Resize handling: rebuild buffer on size change.
      const size = sizeFn();
      if (size.cols !== curSize.cols || size.rows !== curSize.rows) {
        curSize = size;
        buf = new FrameBuffer(size.cols, size.rows);
      }
      renderOnce(rt, host, writer, buf, hits);
      rt.frame++;
      frames++;
      renderAcc -= frameMs;
      steps++;
      if (options.maxFrames !== undefined && frames >= options.maxFrames) {
        rt.quit = true;
        break;
      }
    }

    if (rt.quit) break;
    await sleep(frameMs);
  }
}

function renderOnce(
  rt: ShellRuntime,
  host: ShellHost,
  writer: Writer,
  buf: FrameBuffer,
  hits: HitRegistry,
): void {
  if (rt.flash && rt.frame >= rt.flashUntilFrame) {
    rt.flash = null;
  }
  if (rt.page === 'battle' && rt.battle) advanceBattlePlayback(rt.battle, rt.frame);
  const input: FrameInput = {
    page: rt.page,
    state: host.getState(),
    pack: host.pack,
    mode: writer.color,
    frame: rt.frame,
    ui: rt.ui[rt.page],
    completion: host.completion(),
    flash: rt.flash,
    info: rt.info,
    settings: rt.settings,
    live: host.liveStats?.(),
    battle: rt.battle,
  };
  renderFrame(buf, hits, input);
  buf.flush(writer);
}

export { FRAME_MS, ADVANCE_MS };
