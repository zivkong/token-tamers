/**
 * Persistence for UserConfig (config.json).
 */

import fs from 'node:fs';
import type { UserConfig } from '@token-tamers/core';
import { pathFor, readJsonOrNull, writeJsonAtomic } from './atomic';

export const CONFIG_FILE = 'config.json';

export function loadConfig(): UserConfig | null {
  return readJsonOrNull<UserConfig>(CONFIG_FILE);
}

export function saveConfig(config: UserConfig): void {
  writeJsonAtomic(CONFIG_FILE, config);
}

export function configExists(): boolean {
  return fs.existsSync(pathFor(CONFIG_FILE));
}
