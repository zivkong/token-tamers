import type { UsageEvent } from '@token-tamers/core';
import { claudeCodeAdapter } from './claude-code/index';
import { openCodeAdapter } from './opencode/index';

/** Per-file scan bookkeeping so re-scans are incremental, never full re-reads. */
export interface AdapterCheckpoint {
  files: Record<string, { offset: number; mtimeMs: number }>;
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
   * Optional hint for the cycle-policy default when this adapter is first
   * configured. 'subscription' = dynamic (session-window) policy;
   * 'api' = static (no inherent limits, user sets their own anchor).
   */
  defaultPlan?: 'subscription' | 'api';
  detect(): Promise<AdapterDetection>;
  /** Scan data roots for usage newer than the checkpoint. Read-only, always. */
  scan(paths: string[], checkpoint?: AdapterCheckpoint): Promise<ScanResult>;
}

export { claudeCodeAdapter, openCodeAdapter };

// Implementations are registered here; listed in order of likely adoption.
export const adapters: ProviderAdapter[] = [claudeCodeAdapter, openCodeAdapter];
