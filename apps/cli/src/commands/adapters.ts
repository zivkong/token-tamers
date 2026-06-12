/**
 * `tt adapters` — adapter health and paths.
 */

import { adapters as allAdapters } from '@token-tamers/adapters';

type Out = (s: string) => void;

export async function adaptersCommand(out: Out): Promise<void> {
  out('Adapters\n');
  for (const adapter of allAdapters) {
    const detection = await adapter.detect();
    const mark = detection.installed ? 'ok' : '--';
    out(`  [${mark}] ${adapter.displayName} (${adapter.id})\n`);
    if (detection.paths.length > 0) out(`        paths: ${detection.paths.join(', ')}\n`);
    for (const w of detection.warnings) out(`        ! ${w}\n`);
  }
}
