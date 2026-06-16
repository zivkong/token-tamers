import type { UsageEvent } from '@token-tamers/core';
import { claudeCodeAdapter } from './claude-code/index';
import { openCodeAdapter } from './opencode/index';

/** Per-file scan bookkeeping so re-scans are incremental, never full re-reads. */
export interface AdapterCheckpoint {
  /**
   * `lastMessageId` (optional, additive) lets a scanner dedupe a record group
   * that straddles a scan boundary — Claude Code writes one record per content
   * block, all sharing a message id and repeating identical usage.
   */
  files: Record<string, { offset: number; mtimeMs: number; lastMessageId?: string }>;
}

export interface AdapterDetection {
  installed: boolean;
  /** Data roots that exist on this machine. */
  paths: string[];
  warnings: string[];
}

export interface ScanResult {
  events: UsageEvent[];
  checkpoint: AdapterCheckpoint;
}

export interface ProviderAdapter {
  id: string;
  displayName: string;
  /**
   * Optional hint for the pet-global cycle-policy default when this adapter is
   * first configured. 'subscription' = the subscription (session-window) policy;
   * 'api' = the static policy (no inherent limits, user sets their own anchor).
   */
  defaultPlan?: 'subscription' | 'api';
  /**
   * Discover this adapter's data roots. `roots` (optional) are user-supplied
   * override locations from settings.json (`adapterRoots[<id>]`); when omitted
   * or empty, the adapter uses its built-in default locations. The cli reads
   * settings and passes them — adapters never read `process.env` themselves.
   */
  detect(roots?: string[]): Promise<AdapterDetection>;
  /** Scan data roots for usage newer than the checkpoint. Read-only, always. */
  scan(paths: string[], checkpoint?: AdapterCheckpoint): Promise<ScanResult>;
}

export { claudeCodeAdapter, openCodeAdapter };

// Implementations are registered here; listed in order of likely adoption.
export const adapters: ProviderAdapter[] = [claudeCodeAdapter, openCodeAdapter];
