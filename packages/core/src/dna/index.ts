// DNA hash codec — the social-sharing surface (design §10). Pure & deterministic.
// Public API barrel; internal moves must keep these exports identical.

export { DNA_SCHEMA_VERSION, decodeDna, encodeDna, type DecodedDna } from './codec';
export {
  GRADE_CODES,
  HOUSE_CODES,
  MUTATION_CODES,
  PATTERN_CODES,
  RHYTHM_CODES,
  STAGE_CODES,
  TRAIT_CODES,
} from './registry';
