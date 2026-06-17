/**
 * Persistence for SettingsFile (settings.json) — the file-based home for
 * preferences Token Tamers used to read from environment variables (color,
 * adapter scan roots). Hand-editable; an absent or malformed file resolves to
 * built-in defaults, so the app never requires it to exist.
 */

import type { SettingsFile } from '@token-tamers/core';
import { readJsonOrNull, writeJsonAtomic } from './atomic';

export const SETTINGS_FILE = 'settings.json';

export const SETTINGS_SCHEMA_VERSION = 1;

/** The all-defaults settings used when settings.json is absent. */
export function defaultSettings(): SettingsFile {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    color: 'auto',
    // Auto-probe the terminal for the richest supported sub-cell density.
    subcell: 'auto',
    adapterRoots: {},
    // Off by default — the game stays fully offline until the user opts in.
    update: { mode: 'off' },
  };
}

/** Load settings.json, falling back to defaults (and filling missing fields). */
export function loadSettings(): SettingsFile {
  const raw = readJsonOrNull<Partial<SettingsFile>>(SETTINGS_FILE);
  const base = defaultSettings();
  if (!raw) return base;
  return {
    schemaVersion: raw.schemaVersion ?? base.schemaVersion,
    color: raw.color ?? base.color,
    subcell: raw.subcell ?? base.subcell,
    adapterRoots: raw.adapterRoots ?? base.adapterRoots,
    update: raw.update ?? base.update,
  };
}

export function saveSettings(settings: SettingsFile): void {
  writeJsonAtomic(SETTINGS_FILE, settings);
}

/** Override scan roots configured for an adapter id, or [] when unset. */
export function settingsRootsFor(settings: SettingsFile, adapterId: string): string[] {
  return settings.adapterRoots[adapterId] ?? [];
}
