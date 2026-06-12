import type { UsageEvent } from '@token-tamers/core';
import { claudeCodeAdapter } from './claude-code/index';

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
  detect(): Promise<AdapterDetection>;
  /** Scan data roots for usage newer than the checkpoint. Read-only, always. */
  scan(paths: string[], checkpoint?: AdapterCheckpoint): Promise<ScanResult>;
}

export { claudeCodeAdapter };

// Implementations are registered here; MVP ships claude-code only.
export const adapters: ProviderAdapter[] = [claudeCodeAdapter];
