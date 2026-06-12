import type { ContentPack } from '@token-tamers/core';

// The v1 starter pack is assembled from JSON under content/v1 and exported as
// a typed value so the cli bundle embeds it (zero runtime file reads needed).
export const contentPackV1: ContentPack = {
  version: 1,
  models: [],
  species: [],
  traits: [],
  patterns: [],
  achievements: [],
  habitats: [],
  trinkets: [],
  sprites: [],
  dexTotal: 112,
};
