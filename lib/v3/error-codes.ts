// ============================================================
// ErrorCode — 统一错误码系统
// ============================================================
// 所有 Error 必须使用 ErrorCode，禁止 throw new Error("xxx")
// ============================================================

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  EXECUTION = 'EXECUTION',
  COMPILATION = 'COMPILATION',
  AI = 'AI',
  FILE = 'FILE',
  CONFIG = 'CONFIG',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export interface ErrorCodeDef {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  suggestion?: string;
}

// ============================================================
// ErrorCode Registry
// ============================================================
export const ErrorCodes = {
  // ── Validation ──────────────────────────────────────
  VAL_MISSING_COLUMN: {
    code: 'VAL_MISSING_COLUMN',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.ERROR,
    message: '找不到指定的列',
    suggestion: '请检查列名是否正确，或查看数据预览中的列名列表',
  } as ErrorCodeDef,

  VAL_EMPTY_CONDITION: {
    code: 'VAL_EMPTY_CONDITION',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    message: '筛选条件为空',
    suggestion: '请添加至少一个筛选条件',
  } as ErrorCodeDef,

  VAL_INVALID_OPERATION: {
    code: 'VAL_INVALID_OPERATION',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.ERROR,
    message: '不支持的操作类型',
    suggestion: '请使用支持的操作：筛选、排序、聚合、合并等',
  } as ErrorCodeDef,

  VAL_MERGE_MIN_TABLES: {
    code: 'VAL_MERGE_MIN_TABLES',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.ERROR,
    message: '合并需要至少 2 个表',
    suggestion: '请先在左侧选择多个文件作为任务文件',
  } as ErrorCodeDef,

  VAL_TYPE_MISMATCH: {
    code: 'VAL_TYPE_MISMATCH',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.ERROR,
    message: '数据类型不匹配',
    suggestion: '请检查列的数据类型是否正确',
  } as ErrorCodeDef,

  // ── Execution ───────────────────────────────────────
  EXEC_NO_DATA: {
    code: 'EXEC_NO_DATA',
    category: ErrorCategory.EXECUTION,
    severity: ErrorSeverity.ERROR,
    message: '没有可执行的数据',
    suggestion: '请先在左侧选择一个文件',
  } as ErrorCodeDef,

  EXEC_NO_INTENT: {
    code: 'EXEC_NO_INTENT',
    category: ErrorCategory.EXECUTION,
    severity: ErrorSeverity.ERROR,
    message: '无法理解指令',
    suggestion: '请换个说法再试一次',
  } as ErrorCodeDef,

  EXEC_PLAN_FAILED: {
    code: 'EXEC_PLAN_FAILED',
    category: ErrorCategory.EXECUTION,
    severity: ErrorSeverity.ERROR,
    message: '计划校验失败',
    suggestion: '请检查操作参数是否正确',
  } as ErrorCodeDef,

  EXEC_VERIFY_FAILED: {
    code: 'EXEC_VERIFY_FAILED',
    category: ErrorCategory.EXECUTION,
    severity: ErrorSeverity.WARNING,
    message: '结果验证失败',
    suggestion: '结果可能不符合预期，请检查',
  } as ErrorCodeDef,

  EXEC_NO_RESULT: {
    code: 'EXEC_NO_RESULT',
    category: ErrorCategory.EXECUTION,
    severity: ErrorSeverity.WARNING,
    message: '执行结果为空',
    suggestion: '请检查筛选条件是否过于严格',
  } as ErrorCodeDef,

  // ── Compilation ─────────────────────────────────────
  COMP_UNKNOWN_TYPE: {
    code: 'COMP_UNKNOWN_TYPE',
    category: ErrorCategory.COMPILATION,
    severity: ErrorSeverity.ERROR,
    message: '收到错误的执行计划类型',
    suggestion: '请联系开发者',
  } as ErrorCodeDef,

  COMP_MISSING_SOURCE: {
    code: 'COMP_MISSING_SOURCE',
    category: ErrorCategory.COMPILATION,
    severity: ErrorSeverity.ERROR,
    message: '找不到需要合并的源表',
    suggestion: '请确保任务文件中包含至少两个表',
  } as ErrorCodeDef,

  // ── AI ──────────────────────────────────────────────
  AI_KEY_MISSING: {
    code: 'AI_KEY_MISSING',
    category: ErrorCategory.AI,
    severity: ErrorSeverity.ERROR,
    message: '未配置 API Key',
    suggestion: '请在设置中配置 DeepSeek API Key',
  } as ErrorCodeDef,

  AI_KEY_INVALID: {
    code: 'AI_KEY_INVALID',
    category: ErrorCategory.AI,
    severity: ErrorSeverity.ERROR,
    message: 'API Key 无效',
    suggestion: '请在设置中检查 API Key 是否正确',
  } as ErrorCodeDef,

  AI_PARSE_FAILED: {
    code: 'AI_PARSE_FAILED',
    category: ErrorCategory.AI,
    severity: ErrorSeverity.WARNING,
    message: 'AI 解析失败，已回退到规则解析',
    suggestion: '',
  } as ErrorCodeDef,

  // ── File ────────────────────────────────────────────
  FILE_PARSE_FAILED: {
    code: 'FILE_PARSE_FAILED',
    category: ErrorCategory.FILE,
    severity: ErrorSeverity.ERROR,
    message: '文件解析失败',
    suggestion: '请确保文件格式正确（.xlsx / .csv）',
  } as ErrorCodeDef,

  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    category: ErrorCategory.FILE,
    severity: ErrorSeverity.ERROR,
    message: '文件过大',
    suggestion: '请上传小于 10MB 的文件',
  } as ErrorCodeDef,

  // ── Config ──────────────────────────────────────────
  CFG_MISSING_KEY: {
    code: 'CFG_MISSING_KEY',
    category: ErrorCategory.CONFIG,
    severity: ErrorSeverity.WARNING,
    message: '缺少配置项',
    suggestion: '',
  } as ErrorCodeDef,

  // ── Unknown ─────────────────────────────────────────
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.ERROR,
    message: '未知错误',
    suggestion: '请重试或联系开发者',
  } as ErrorCodeDef,
};

// ============================================================
// AppError — 结构化错误类
// ============================================================
export class AppError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly suggestion: string;

  constructor(def: ErrorCodeDef, extra?: string) {
    const msg = extra ? `${def.message}: ${extra}` : def.message;
    super(msg);
    this.name = 'AppError';
    this.code = def.code;
    this.category = def.category;
    this.severity = def.severity;
    this.suggestion = def.suggestion ?? '';
  }

  toJSON() {
    return {
      code: this.code,
      category: this.category,
      severity: this.severity,
      message: this.message,
      suggestion: this.suggestion,
    };
  }
}
