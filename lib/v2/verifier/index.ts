// ============================================================
// verifier — V2 结果验证系统统一导出
// ============================================================

export { VerifierRegistry, verifierRegistry } from './registry';
export { FilterVerifier } from './FilterVerifier';
export { SortVerifier } from './SortVerifier';
export { AggregateVerifier } from './AggregateVerifier';
export { DedupVerifier } from './DedupVerifier';
export { MatchVerifier } from './MatchVerifier';
export { ProjectionVerifier } from './ProjectionVerifier';
export { UpdateVerifier } from './UpdateVerifier';
export { FormulaVerifier } from './FormulaVerifier';
export { PipelineVerifier } from './PipelineVerifier';
export { runVerification } from './run-verification';

export type { Verifier, VerificationResult, VerificationCheck } from './types';

import { verifierRegistry } from './registry';
import { FilterVerifier } from './FilterVerifier';
import { SortVerifier } from './SortVerifier';
import { AggregateVerifier } from './AggregateVerifier';
import { DedupVerifier } from './DedupVerifier';
import { MatchVerifier } from './MatchVerifier';
import { ProjectionVerifier } from './ProjectionVerifier';
import { UpdateVerifier } from './UpdateVerifier';
import { FormulaVerifier } from './FormulaVerifier';
import { PipelineVerifier } from './PipelineVerifier';

/** 应用启动时注册所有内置 Verifier */
export function registerAllVerifiers(): void {
  verifierRegistry.registerAll(
    new FilterVerifier(),
    new SortVerifier(),
    new AggregateVerifier(),
    new DedupVerifier(),
    new MatchVerifier(),
    new ProjectionVerifier(),
    new UpdateVerifier(),
    new FormulaVerifier(),
    new PipelineVerifier(),
  );
}
