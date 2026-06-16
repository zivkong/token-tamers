// Battle engine (design §11) — pure, deterministic, seeded combat over decoded
// DNA. Public API barrel; internal moves must keep these exports identical.

export {
  combatantFromDecoded,
  combatantFromSnapshot,
  effectiveStats,
  sameSpecies,
} from './combatant';
export { resolveProcs, type ProcResult } from './procs';
export { battleSeed } from './seed';
export { simulateBattle } from './simulate';
export { typeMultiplier } from './wheel';
