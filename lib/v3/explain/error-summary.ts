// ============================================================
// Error Summary — 错误翻译
// ============================================================
// 所有 ErrorRecord 必须生成「原因 + 影响 + 建议」
// ============================================================

export interface ExplainedError {
  reason: string;
  impact: string;
  suggestion: string;
}

export function explainError(error: string | null): ExplainedError | null {
  if (!error) return null;

  const normalized = error.toLowerCase();

  // 列不存在
  if (normalized.includes('找不到列') || normalized.includes('列不存在') || normalized.includes('column not found')) {
    return {
      reason: '数据表中没有找到指定的列。',
      impact: '操作无法针对不存在的列执行，流程已中断。',
      suggestion: '请检查输入的列名是否与数据表标题完全一致，或从数据预览中选择可用列。',
    };
  }

  // 类型不匹配
  if (normalized.includes('类型不匹配') || normalized.includes('类型错误') || (normalized.includes('avg') || normalized.includes('sum')) && normalized.includes('文本')) {
    return {
      reason: '操作的数据类型与列的实际类型不一致。',
      impact: '该操作无法在当前列上执行，结果可能不准确。',
      suggestion: '平均值、求和等操作只能用于数值列。请选择工资、金额、数量等数值列。',
    };
  }

  // 验证失败
  if (normalized.includes('验证失败') || normalized.includes('校验失败')) {
    return {
      reason: '执行结果未通过系统验证。',
      impact: '结果可能存在异常，不建议直接使用。',
      suggestion: '请检查输入数据是否正确，或尝试调整操作条件后重新执行。',
    };
  }

  // 空结果
  if (normalized.includes('0 行') || normalized.includes('没有数据') || normalized.includes('无结果') || normalized.includes('empty')) {
    return {
      reason: '筛选条件没有命中任何数据。',
      impact: '操作已执行但未产生有效输出。',
      suggestion: '检查筛选值是否存在，或放宽筛选条件后重试。',
    };
  }

  // 匹配失败
  if (normalized.includes('匹配') && (normalized.includes('失败') || normalized.includes('未匹配'))) {
    return {
      reason: '两张表中的匹配键值无法对应。',
      impact: '部分数据无法完成关联。',
      suggestion: '检查两张表的匹配键列是否存在相同值，尝试删除空格或统一数据格式。',
    };
  }

  // 通用
  if (normalized.includes('plan') && normalized.includes('fail')) {
    return {
      reason: '无法为当前指令生成有效执行计划。',
      impact: '系统无法理解您想要的操作。',
      suggestion: '请尝试更明确的描述，或使用更简单的操作。',
    };
  }

  // 空值相关
  if (normalized.includes('空值') || normalized.includes('null')) {
    return {
      reason: '数据中存在空值。',
      impact: '可能影响计算结果的准确性。',
      suggestion: '建议先对空值进行处理（删除或填充），或使用忽略空值的操作。',
    };
  }

  // V2 执行错误
  if (normalized.includes('v2 执行出错') || normalized.includes('execution error')) {
    return {
      reason: '执行引擎处理数据时发生内部错误。',
      impact: '操作无法完成。',
      suggestion: '请检查数据是否符合预期格式，或简化操作后重试。',
    };
  }

  return null;
}

export function buildErrorDetails(error: string | null): string[] {
  if (!error) return [];

  const explained = explainError(error);
  if (explained) {
    return [
      `错误：${error}`,
      `原因：${explained.reason}`,
      `影响：${explained.impact}`,
      `建议：${explained.suggestion}`,
    ];
  }

  return [`错误：${error}`];
}

export function buildErrorTitle(error: string | null): string {
  if (!error) return '执行失败';

  const explained = explainError(error);
  if (explained) return `执行失败 — ${explained.reason}`;

  return '执行失败';
}
