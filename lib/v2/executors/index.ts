// ============================================================
// executors 统一导出
// ============================================================

export { ExecutorRegistry } from './registry';
export { FilterExecutor } from './FilterExecutor';
export { SortExecutor } from './SortExecutor';
export { AggregateExecutor } from './AggregateExecutor';
export { DedupExecutor } from './DedupExecutor';
export { MatchExecutor } from './MatchExecutor';
export { MergeExecutor } from './MergeExecutor';
export { CleanExecutor } from './CleanExecutor';
export { UpdateExecutor } from './UpdateExecutor';
export { FormulaExecutor } from './FormulaExecutor';
export { PipelineExecutor } from './PipelineExecutor';

export type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
