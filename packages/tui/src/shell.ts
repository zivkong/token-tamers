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
import { decode, type InputEvent } from './terminal/input';
import { computeLayout } from './render/layout';
import { renderFrame, type FrameInput } from './render/frame';
import { packMenu } from './render/menu';
import type {
  AdapterInfo,
  LiveStats,
  PageId,
  PageUiState,
  ShellInfo,
  SettingsState,
} from './pages/types';
import { buildDexRows } from './pages/dex';
import { cycleSelectedField, settingsFieldCount } from './pages/settings';
import type { ContentPack, GameEffect, GameState } from '@token-tamers/core';

// Re-exported shell host/options contract (kept identical to src/index.ts).
export interface ShellHost {
  pack: ContentPack;
  getState(): GameState;
  advance(now: number): GameEffect[];
  completion(): { overall: number };
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
  /** Initial adapter configs (a working copy is edited on the Settings page). */
  adapters?: AdapterInfo[];
  /**
   * Persist edited adapter plan/cycle toggles. Called on each change with the
   * full working copy; the host writes config.json (applied on next launch).
   */
  onAdaptersChange?: (adapters: AdapterInfo[]) => void;
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

/** Internal mutable shell runtime. */
interface ShellRuntime {
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
  /** Persist hook for adapter edits (from options). */
  onAdaptersChange?: (adapters: AdapterInfo[]) => void;
}

/** Resolved loop dependencies (injected once, passed as a unit). */
interface LoopContext {
  options: ShellOptions;
  writer: Writer;
  sizeFn: () => { cols: number; rows: number };
  now: () => number;
  frameMs: number;
}

function freshUi(): Record<PageId, PageUiState> {
  return {
    pet: { selected: 0, scroll: 0 },
    dex: { selected: 0, scroll: 0 },
    archive: { selected: 0, scroll: 0 },
    settings: { selected: 0, scroll: 0 },
  };
}

/** Seed the editable Settings state from a working copy of the adapter configs. */
function initialSettings(adapters: AdapterInfo[] | undefined): SettingsState {
  const copy = (adapters ?? []).map((a) => ({ ...a }));
  return { adapters: copy, selected: copy.length > 0 ? 0 : -1 };
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
    page: 'pet',
    frame: 0,
    ui: freshUi(),
    flash: null,
    flashUntilFrame: 0,
    quit: false,
    info: options.info,
    settings: initialSettings(options.adapters),
    onAdaptersChange: options.onAdaptersChange,
  };

  const inputSource = options.input ?? (manageTerminal ? stdinSource() : nullSource());
  const unsubscribe = inputSource.onEvent((ev) => handleEvent(rt, ev, options.host));

  const cleanup = manageTerminal ? enterTerminal(writer) : () => {};

  try {
    inputSource.start?.();
    const ctx: LoopContext = { options, writer, sizeFn, now, frameMs };
    await loop(rt, ctx);
  } finally {
    unsubscribe();
    inputSource.stop?.();
    cleanup();
    writer.restore();
  }
}

async function loop(rt: ShellRuntime, ctx: LoopContext): Promise<void> {
  const { options, writer, sizeFn, now, frameMs } = ctx;
  const host = options.host;
  let last = now();
  let renderAcc = 0;
  let advanceAcc = 0;
  let frames = 0;

  const hits = new HitRegistry();
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
  const input: FrameInput = {
    page: rt.page,
    state: host.getState(),
    pack: host.pack,
    mode: writer.color,
    frame: rt.frame,
    ui: rt.ui[rt.page],
    completionPct: host.completion().overall,
    flash: rt.flash,
    info: rt.info,
    settings: rt.settings,
    live: host.liveStats?.(),
  };
  renderFrame(buf, hits, input);
  buf.flush(writer);
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

function handleEvent(rt: ShellRuntime, ev: InputEvent, host: ShellHost): void {
  if (ev.type === 'key') {
    handleKey(rt, ev.name, host);
    return;
  }
  handleMouse(rt, ev, host);
}

function handleKey(rt: ShellRuntime, name: string, host: ShellHost): void {
  switch (name) {
    case 'ctrl-c':
    case 'q':
      rt.quit = true;
      return;
    case '1':
      rt.page = 'pet';
      return;
    case '2':
      rt.page = 'dex';
      return;
    case '3':
      rt.page = 'archive';
      return;
    case '4':
      rt.page = 'settings';
      return;
    case 'up':
      moveSelection(rt, host, -1);
      return;
    case 'down':
      moveSelection(rt, host, +1);
      return;
    case 'left':
      adjustSetting(rt, -1);
      return;
    case 'right':
      adjustSetting(rt, +1);
      return;
    default:
      return;
  }
}

/** Cycle the focused Settings field and persist (no-op off the Settings page). */
function adjustSetting(rt: ShellRuntime, delta: number): void {
  if (rt.page !== 'settings') return;
  if (settingsFieldCount(rt.settings) === 0) return;
  cycleSelectedField(rt.settings, delta);
  rt.onAdaptersChange?.(rt.settings.adapters);
}

function handleMouse(
  rt: ShellRuntime,
  ev: Extract<InputEvent, { type: 'mouse' }>,
  host: ShellHost,
): void {
  if (ev.action === 'wheel-up') {
    moveSelection(rt, host, -1);
    return;
  }
  if (ev.action === 'wheel-down') {
    moveSelection(rt, host, +1);
    return;
  }
  if (ev.action !== 'press') return;

  // Re-derive hit regions for the current frame size to resolve the click.
  const size = defaultSizeSafe();
  const layout = computeLayout(size.cols, size.rows);
  // SGR mouse is 1-based; convert to 0-based cell coords.
  const cx = ev.x - 1;
  const cy = ev.y - 1;

  // Menu clicks: hit-test the same left-aligned flow the renderer drew.
  for (const btn of packMenu(layout.termCols).buttons) {
    const y = layout.menuY + btn.row;
    if (cx >= btn.x && cx < btn.x + btn.w && cy === y) {
      activate(rt, btn.id);
      return;
    }
  }

  // List-row clicks (Dex/Archive): map by canvas geometry, ignoring the menu.
  if ((rt.page === 'dex' || rt.page === 'archive') && cy < layout.menuY) {
    const listTop = layout.canvasY + 2;
    const idxOnScreen = cy - listTop;
    if (idxOnScreen >= 0) {
      const ui = rt.ui[rt.page];
      const target = ui.scroll + idxOnScreen;
      const max = rowCount(rt, host) - 1;
      if (target >= 0 && target <= max) {
        ui.selected = target;
      }
    }
  }
}

function activate(rt: ShellRuntime, id: PageId | 'quit'): void {
  if (id === 'quit') {
    rt.quit = true;
    return;
  }
  rt.page = id;
}

function moveSelection(rt: ShellRuntime, host: ShellHost, delta: number): void {
  if (rt.page === 'settings') {
    const max = settingsFieldCount(rt.settings) - 1;
    if (max < 0) return;
    rt.settings.selected = Math.max(0, Math.min(max, rt.settings.selected + delta));
    return;
  }
  if (rt.page !== 'dex' && rt.page !== 'archive') return;
  const ui = rt.ui[rt.page];
  const max = rowCount(rt, host) - 1;
  ui.selected = Math.max(0, Math.min(max, ui.selected + delta));
}

function rowCount(rt: ShellRuntime, host: ShellHost): number {
  const state = host.getState();
  if (rt.page === 'archive') return state.archive.length;
  if (rt.page === 'dex') {
    // Build minimal context for counting Dex rows.
    const ctx = {
      pack: host.pack,
      state,
    } as unknown as Parameters<typeof buildDexRows>[0];
    return buildDexRows(ctx).length;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Effects -> transient UI (MVP: a gradeshift flash line)
// ---------------------------------------------------------------------------

function applyEffects(rt: ShellRuntime, effects: GameEffect[]): void {
  for (const e of effects) {
    if (e.type === 'gradeshift') {
      flash(rt, `✦ Grade up! ${e.from} → ${e.to} (${Math.round(e.chance * 100)}%)`);
    } else if (e.type === 'evolved') {
      flash(rt, `✦ Evolved: ${e.from} → ${e.to}`);
    } else if (e.type === 'grade_roll_failed') {
      flash(rt, `Grade held at ${e.grade} (${Math.round(e.chance * 100)}%)`);
    } else if (e.type === 'rebirth') {
      flash(rt, `↻ Rebirth — legacy grade ${e.legacyGrade}, gen ${e.newGeneration}`);
    }
  }
}

function flash(rt: ShellRuntime, msg: string): void {
  rt.flash = msg;
  // Show for ~2 seconds of frames (assume 30fps cadence).
  rt.flashUntilFrame = rt.frame + 60;
}

// ---------------------------------------------------------------------------
// IO wiring (defaults; tests inject their own)
// ---------------------------------------------------------------------------

function stdoutSink(): OutputSink {
  return {
    write(s: string): void {
      process.stdout.write(s);
    },
  };
}

function defaultSize(): { cols: number; rows: number } {
  return {
    cols: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
  };
}

function defaultSizeSafe(): { cols: number; rows: number } {
  try {
    return defaultSize();
  } catch {
    return { cols: 80, rows: 24 };
  }
}

function enterTerminal(writer: Writer): () => void {
  writer.enterAltScreen();
  writer.hideCursor();
  writer.enableMouse();
  writer.clearScreen();
  const stdin = process.stdin;
  if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
    stdin.setRawMode(true);
  }
  const onSig = () => {
    writer.restore();
    process.exit(0);
  };
  process.once('SIGINT', onSig);
  process.once('SIGTERM', onSig);
  return () => {
    if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(false);
    }
    process.removeListener('SIGINT', onSig);
    process.removeListener('SIGTERM', onSig);
  };
}

function stdinSource(): InputSource {
  let listener: ((ev: InputEvent) => void) | null = null;
  const onData = (chunk: Buffer | string) => {
    if (!listener) return;
    const events = decode(chunk.toString('utf8'));
    for (const ev of events) listener(ev);
  };
  return {
    onEvent(cb) {
      listener = cb;
      return () => {
        if (listener === cb) listener = null;
      };
    },
    start() {
      process.stdin.resume();
      process.stdin.on('data', onData);
    },
    stop() {
      process.stdin.removeListener('data', onData);
      process.stdin.pause();
    },
  };
}

function nullSource(): InputSource {
  return {
    onEvent() {
      return () => {};
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { FRAME_MS, ADVANCE_MS };
