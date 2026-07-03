// ============================================================
// runOutputProcessor — V2 统一输出处理入口
// ============================================================

import type { ColumnDef, RowData } from '@/lib/types';
import type { OutputSpec } from '../execution-plan';
import { DefaultOutputProcessor } from './OutputProcessor';
import type { ProcessedResult } from './OutputProcessor';

const defaultProcessor = new DefaultOutputProcessor();

/**
 * 统一切换输出处理入口
 *
 * @param rows    执行后的原始数据行
 * @param columns 执行后的原始列定义
 * @param output  OutputSpec 约束（可选）
 * @returns 格式化后的结果
 */
export function runOutputProcessor(
  rows: RowData[],
  columns: ColumnDef[],
  output?: OutputSpec | null,
): ProcessedResult {
  return defaultProcessor.process(rows, columns, output);
}
