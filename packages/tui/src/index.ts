import type { ContentPack, GameEffect, GameState } from '@token-tamers/core';

/** What the shell needs from the host (the cli wires an engine + store in). */
export interface ShellHost {
  pack: ContentPack;
  getState(): GameState;
  /** Advance the simulation; called by the shell's tick loop. Returns effects to animate. */
  advance(now: number): GameEffect[];
  completion(): { overall: number };
}

export interface ShellOptions {
  host: ShellHost;
  fps?: number;
  color?: 'truecolor' | '256' | '8' | 'none';
}

/** Run the clickable 4:3 shell (Pet/Dex/Archive pages). Resolves on quit. */
export async function runShell(_options: ShellOptions): Promise<void> {
  throw new Error('not implemented yet');
}
