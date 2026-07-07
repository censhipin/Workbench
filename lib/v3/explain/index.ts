// ============================================================
// Explain — 智能解释层统一出口
// ============================================================

export type { ExecutionExplanation, ExplainInput, JoinStatistics, ExplainSuggestion } from './types';
export { buildExecutionExplanation } from './builder';
export { buildSummary } from './summary';
export { buildWarnings } from './warning';
export { buildSuggestions } from './suggestion';
export { buildRepairSummary } from './repair-summary';
export { buildProfileDetails } from './profile-summary';
export { buildExecutionDetails } from './execution-summary';
export { buildVerificationDetails } from './verification-summary';
export { buildErrorDetails, buildErrorTitle, explainError } from './error-summary';
