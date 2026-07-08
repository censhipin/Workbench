export interface ColumnDef {
  key: string;
  title: string;
  type: 'text' | 'number' | 'date';
  width?: number;
}

export type Operation =
  | 'sort'
  | 'filter'
  | 'sum'
  | 'dedup'
  | 'match'
  | 'merge'
  | 'clean'
  | 'update'
  | 'formula'
  | 'pipeline'
  | 'select'
  | 'remove'
  | null;

export interface TaskIntent {
  operation: Operation;
  /** 语义目标对象（如"销售额"、"工资"、"手机号"） */
  target: string;
  /** Schema Resolver 解析后的列候选列表（执行前需 resolve 或确认） */
  targetColumns: ColumnMatch[];
  /** 用户确认或 Schema Resolver 确认后的最终列 */
  resolvedColumns?: ColumnMatch[];
  /** 作用范围：all | selected | filtered */
  scope: 'all' | 'selected' | 'filtered';
  /** 分组条件 */
  groupBy?: string[];
  /** 筛选条件 */
  filters?: import('./nlu/types').FilterCondition[];
  /** 聚合方式 */
  aggregation?: import('./nlu/types').AggregationType;
  /** 输出约束 */
  output?: import('./nlu/taskplan-types').OutputOptions;
  params: Record<string, unknown>;
  targetFiles: string[];
  rawPrompt: string;
  confidence: number;
  /** V2 ExecutionPlan（TaskCompiler 编译结果，存在时走 V2 执行链路） */
  v2plan?: import('./v2/execution-plan').ExecutionPlan;
  /** Pipeline 子步骤（仅 operation='pipeline' 时存在） */
  steps?: TaskIntent[];
}

export interface ColumnMatch {
  key: string;
  title: string;
  confidence: number;
  matchMethod: 'exact' | 'fuzzy' | 'semantic';
}

export type RowData = Record<string, string | number | null>;

export interface SheetInfo {
  name: string;
  columns: ColumnDef[];
  rows: RowData[];
}

export interface WorkbenchFile {
  id: string;
  name: string;
  icon: string;
  sheets: SheetInfo[];
  rowCount: number;
  colCount: number;
  isMock: boolean;
  rawFile?: File;
}

export type EditMode = 'locked' | 'editing';

export interface CellHighlight {
  rowIndex: number;
  colKey: string;
  startedAt: number;
}

export interface HistoryItem {
  id: string;
  action: string;
  timestamp: string;
  targetFiles: string[];
  resultData?: { columns: ColumnDef[]; rows: RowData[] } | null;
  resultSummary?: ResultSummary | null;
}

export type StepStatus = 'waiting' | 'executing' | 'completed' | 'failed' | 'skipped';

export interface StepSubItem {
  label: string;
  value: string | number;
}

export interface PlanStep {
  id: string;
  order: number;
  description: string;
  isDangerous: boolean;
  status: StepStatus;
  details?: string;
  subItems?: StepSubItem[];
}

export interface TaskAnalysis {
  taskType: string;
  matchField?: string;
  mainTable?: string;
  lookupTables?: string[];
  totalRecords?: number;
  estimatedResult?: number;
}

export interface ResultSummary {
  totalRecords: number;
  matchedCount?: number;
  unmatchedCount?: number;
  deletedCount?: number;
  modifiedCount?: number;
  beforeCount?: number;
  afterCount?: number;
  details?: { label: string; before: number; after: number; deleted: number; selected: boolean }[];
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

export interface AuditStats {
  totalRows: number;
  totalCols: number;
  blankCells: number;
  blankRows: number;
  numericCols: number;
  textCols: number;
  dateCols: number;
}

export interface AnomalyRecord {
  rowIndex: number;
  fieldKey: string;
  fieldLabel: string;
  originalValue: string;
  issueType: string;
  issueReason: string;
  canAutoFix: boolean;
  fixedValue?: string;
  rowData?: Record<string, string | number | null>;
}

export interface DuplicateRecord {
  rowIndex: number;
  duplicateOf: number;
  values: Record<string, string>;
}

export interface NullRecord {
  rowIndex: number;
  fieldKey: string;
  fieldLabel: string;
}

export interface DuplicateFinding {
  fieldKey: string;
  fieldLabel: string;
  count: number;
  sampleValues: string[];
  records: DuplicateRecord[];
}

export interface NullFinding {
  fieldKey: string;
  fieldLabel: string;
  missingCount: number;
  records: NullRecord[];
}

export interface AnomalyFinding {
  fieldKey: string;
  fieldLabel: string;
  issueType: string;
  count: number;
  affectedRows: number[];
  records: AnomalyRecord[];
  canAutoFix: boolean;
}

export interface FixSuggestion {
  id: string;
  text: string;
  fixType: 'dedup' | 'clean' | 'format';
  findingKey: string;
}

export interface FixResult {
  fixedCount: number;
  message: string;
  category: string;
}

export interface AuditReport {
  stats: AuditStats;
  duplicates: DuplicateFinding[];
  nulls: NullFinding[];
  anomalies: AnomalyFinding[];
  qualityScore: number;
  qualityGrade: string;
  suggestions: FixSuggestion[];
}

// ── Version Management ──────────────────────────────────────────────────────

export interface Version {
  id: string;
  fileId: string;
  version: number;
  parentVersion?: string;
  operation: string;
  plan: object;
  columns: ColumnDef[];
  rows: RowData[];
  createdAt: string;
}

export type DataTab = 'original' | 'result' | 'compare';
export type PlanViewMode = 'human' | 'developer';
