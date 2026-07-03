import { describe, it, expect } from 'vitest';
import { RuleBasedSemanticParser } from '@/lib/nlu/semantic-parser';
import { defaultLexicon } from '@/lib/nlu/intent-lexicon';
import { ruleIntentToTaskPlan } from '@/lib/nlu/rule-taskplan-converter';
import { compile } from '@/lib/v2/task-compiler';
import { runExecutionPlan } from '@/lib/v2/execution-engine';
import type { ColumnDef } from '@/lib/types';

const parser = new RuleBasedSemanticParser(defaultLexicon);

// 完全模拟销售数据
const salesCols: ColumnDef[] = [
  { key: 'date', title: '日期', type: 'date' },
  { key: 'salesperson', title: '销售人员', type: 'text' },
  { key: 'product', title: '产品', type: 'text' },
  { key: 'qty', title: '数量', type: 'number' },
  { key: 'price', title: '单价', type: 'number' },
  { key: 'amount', title: '金额', type: 'number' },
];
const salesRows = [
  { product: 'A', qty: 10, price: 100, amount: 1000 },
  { product: 'B', qty: 5, price: 200, amount: 1000 },
  { product: 'A', qty: 15, price: 100, amount: 1500 },
];

describe('端到端：金额乘以0.9', () => {
  it('全链路解析→编译→执行', () => {
    // 解析
    const intent = parser.parse('新增一列折扣金额，金额乘以0.9', salesCols, []);
    expect(intent.operation).toBe('formula');
    expect(intent.params.sourceColumnHints).toEqual(['金额']);
    expect(intent.params.constantOperand).toBe(0.9);
    expect(intent.params.expressionType).toBe('*');

    // 转 TaskPlan
    const plan = ruleIntentToTaskPlan(intent);
    expect(plan.constantOperand).toBe(0.9);
    expect(plan.sourceColumnHints).toEqual(['金额']);

    // 编译
    const compiled = compile(plan, salesCols);
    expect(compiled.success).toBe(true);

    // 执行
    const result = runExecutionPlan(compiled.plan!, {
      columns: salesCols, rows: salesRows,
    });
    expect(result.success).toBe(true);
    if (result.data) {
      const r0 = result.data.rows[0] as any;
      const r1 = result.data.rows[1] as any;
      const r2 = result.data.rows[2] as any;
      // 1000*0.9=900, 1000*0.9=900, 1500*0.9=1350
      expect(Number(r0['折扣金额'])).toBe(900);
      expect(Number(r1['折扣金额'])).toBe(900);
      expect(Number(r2['折扣金额'])).toBe(1350);
    }
  });
});

describe('端到端：按产品统计金额总和', () => {
  it('解析正确性', () => {
    const intent = parser.parse('按产品统计金额总和', salesCols, []);
    expect(intent.operation).toBe('sum');
    expect(intent.target).toBe('金额');
    expect(intent.groupBy).toEqual(['产品']);
    expect(intent.aggregation).toBe('SUM');
  });
});
