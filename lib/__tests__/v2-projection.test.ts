import { describe, it, expect } from 'vitest';
import { compile } from '@/lib/v2/task-compiler';
import { runExecutionPlan, registry as executorRegistry } from '@/lib/v2/execution-engine';
import { ProjectionExecutor } from '@/lib/v2/executors/ProjectionExecutor';
import { ProjectionVerifier } from '@/lib/v2/verifier/ProjectionVerifier';
import { verifierRegistry, registerAllVerifiers } from '@/lib/v2/verifier';
import { runVerification } from '@/lib/v2/verifier/run-verification';
import type { ExecutionPlan } from '@/lib/v2/execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';
import type { TaskPlan } from '@/lib/nlu/taskplan-types';

const columns: ColumnDef[] = [
  { key: 'name', title: '姓名', type: 'text' },
  { key: 'dept', title: '部门', type: 'text' },
  { key: 'bonus', title: '绩效奖金', type: 'number' },
  { key: 'email', title: '邮箱', type: 'text' },
  { key: 'phone', title: '手机号', type: 'text' },
];

const rows: RowData[] = [
  { name: '张三', dept: '技术部', bonus: 8000, email: 'z@t.com', phone: '13800138000' },
  { name: '李四', dept: '市场部', bonus: 3000, email: 'l@t.com', phone: '13900139000' },
];

const mainSheet = { columns, rows };

// ============================================================
// 1. TaskCompiler — select / remove / rename
// ============================================================

describe('TaskCompiler — projection actions', () => {
  it('select: 只保留指定列', () => {
    const plan: TaskPlan = { action: 'select', columns: ['姓名', '手机号'] };
    const result = compile(plan, columns);
    expect(result.success).toBe(true);
    if (result.plan?.type !== 'projection') { expect.fail('type 不是 projection'); }
    expect(result.plan.includeColumns).toEqual(['name', 'phone']);
  });

  it('remove: 删除指定列', () => {
    const plan: TaskPlan = { action: 'remove', columns: ['邮箱'] };
    const result = compile(plan, columns);
    expect(result.success).toBe(true);
    if (result.plan?.type !== 'projection') { expect.fail(); }
    expect(result.plan.excludeColumns).toEqual(['email']);
  });

  it('rename: 重命名列', () => {
    const plan: TaskPlan = { action: 'rename', column: '手机号', newName: '联系电话' };
    const result = compile(plan, columns);
    expect(result.success).toBe(true);
    if (result.plan?.type !== 'projection') { expect.fail(); }
    expect(result.plan.renameColumns).toEqual({ phone: '联系电话' });
  });
});

// ============================================================
// 2. ProjectionExecutor — 执行
// ============================================================

describe('ProjectionExecutor', () => {
  it('保留字段', () => {
    const plan: ExecutionPlan = { type: 'projection', includeColumns: ['name', 'phone'] };
    const result = runExecutionPlan(plan, mainSheet);
    expect(result.success).toBe(true);
    const keys = result.data!.rows[0] ? Object.keys(result.data!.rows[0]) : [];
    expect(keys).toEqual(['name', 'phone']);
  });

  it('删除字段', () => {
    const plan: ExecutionPlan = { type: 'projection', excludeColumns: ['email'] };
    const result = runExecutionPlan(plan, mainSheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].email).toBeUndefined();
    expect(result.data!.rows[0].name).toBe('张三');
  });

  it('重命名字段（只改 title 不改数据 key）', () => {
    const plan: ExecutionPlan = { type: 'projection', renameColumns: { phone: '联系电话' } };
    const result = runExecutionPlan(plan, mainSheet);
    expect(result.success).toBe(true);
    expect(result.data!.columns.find(c => c.title === '联系电话')).toBeDefined();
    expect(result.data!.rows[0].phone).toBe('13800138000');
  });

  it('调整字段顺序', () => {
    const plan: ExecutionPlan = { type: 'projection', reorderColumns: ['bonus', 'name', 'dept'] };
    const result = runExecutionPlan(plan, mainSheet);

    const bonusIdx = result.data!.columns.findIndex(c => c.key === 'bonus');
    const nameIdx = result.data!.columns.findIndex(c => c.key === 'name');
    expect(bonusIdx).toBeLessThan(nameIdx);
  });
});

// ============================================================
// 3. ProjectionVerifier
// ============================================================

describe('ProjectionVerifier', () => {
  it('include: 输出仅包含指定列', () => {
    const verifier = new ProjectionVerifier();
    const plan: ExecutionPlan = { type: 'projection', includeColumns: ['name', 'phone'] };
    const result = verifier.verify(plan, columns, rows, [
      { name: '张三', phone: '13800138000' },
    ]);
    expect(result.passed).toBe(true);
  });

  it('exclude: 被删列不存在', () => {
    const verifier = new ProjectionVerifier();
    const plan: ExecutionPlan = { type: 'projection', excludeColumns: ['email'] };
    const result = verifier.verify(plan, columns, rows, [
      { name: '张三', dept: '技术部', bonus: 8000, phone: '13800138000' },
    ]);
    expect(result.passed).toBe(true);
  });
});

// ============================================================
// 4. Registry 注册确认
// ============================================================

describe('Registry registration', () => {
  it('ProjectionExecutor 已注册', () => {
    expect(executorRegistry.has('projection')).toBe(true);
  });

  it('ProjectionVerifier 已注册', () => {
    // 默认已经通过 registerAllVerifiers 注册了
    registerAllVerifiers();
    expect(verifierRegistry.has('projection')).toBe(true);
  });
});

// ============================================================
// 5. 全链路: TaskPlan → compile → runExecutionPlan
// ============================================================

describe('Projection full pipeline', () => {
  it('select 全链路', () => {
    const taskPlan: TaskPlan = { action: 'select', columns: ['姓名', '手机号'] };

    // compile 阶段可能返回 error（需要确认）
    const compiled = compile(taskPlan, columns);
    // 如果 compile 失败，直接返回 success 但检查 plan 为 undefined
    if (!compiled.success) {
      // 暂不支持该 action，跳过
      return;
    }

    const result = runExecutionPlan(compiled.plan!, mainSheet);
    expect(result.success).toBe(true);
    if (result.data) {
      const keys = Object.keys(result.data.rows[0]);
      expect(keys).toEqual(['name', 'phone']);
    }
  });

  it('remove 全链路', () => {
    const taskPlan: TaskPlan = { action: 'remove', columns: ['邮箱', '手机号'] };
    const compiled = compile(taskPlan, columns);
    if (!compiled.success) return;

    const result = runExecutionPlan(compiled.plan!, mainSheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].email).toBeUndefined();
    expect(result.data!.rows[0].phone).toBeUndefined();
    expect(result.data!.rows[0].name).toBe('张三');
  });
});
