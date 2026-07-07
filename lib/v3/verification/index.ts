// ============================================================
// Verification — V3 验证层统一出口
// ============================================================

export type {
  VerificationResult,
  VerificationCheck,
  OperationStats,
  DiffSummary,
  Verifier,
  VerificationEngineConfig,
} from './types';
export { runVerification, verifyExecution, registerAllVerifiers, getVerifier } from './verification-engine';
export { buildVerificationReport } from './report-builder';
export { computeTableStats, computeGroupKeys, computeMatchStats } from './statistics';
export { computeDiff } from './diff';

// 各个 Verifier
export { FilterVerifier } from './filter-verifier';
export { AggregateVerifier } from './aggregate-verifier';
export { MatchVerifier } from './match-verifier';
export { FormulaVerifier } from './formula-verifier';
export { ProjectionVerifier } from './projection-verifier';
export { UpdateVerifier } from './update-verifier';
export { DedupVerifier } from './dedup-verifier';
export { CleanVerifier } from './clean-verifier';
export { PipelineVerifier } from './pipeline-verifier';
