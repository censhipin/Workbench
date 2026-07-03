// ============================================================
// ExecutorRegistry — OperationExecutor 注册中心
// ============================================================
// 职责：
//   - 注册各操作类型的 Executor
//   - 根据 plan.type 获取对应 Executor
//   - 未知 type 返回明确错误
// ============================================================

import { type OperationExecutor } from './types';

/**
 * ExecutorRegistry
 *
 * 使用方式：
 *   import { registry } from './registry';
 *   registry.register(new FilterExecutor());
 *   const executor = registry.get('filter');
 *   executor.execute(plan, ctx);
 */
export class ExecutorRegistry {
  private executors = new Map<string, OperationExecutor>();

  /** 注册一个执行器 */
  register(executor: OperationExecutor): void {
    this.executors.set(executor.type, executor);
  }

  /** 根据 type 获取执行器，找不到返回 undefined */
  get(type: string): OperationExecutor | undefined {
    return this.executors.get(type);
  }

  /** 是否已注册某 type */
  has(type: string): boolean {
    return this.executors.has(type);
  }

  /** 返回所有已注册的 type */
  types(): string[] {
    return Array.from(this.executors.keys());
  }

  /** 批量注册 */
  registerAll(...executors: OperationExecutor[]): void {
    for (const ex of executors) {
      this.register(ex);
    }
  }
}

/** 全局单例 */
export const registry = new ExecutorRegistry();
