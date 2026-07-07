// ============================================================
// Execution Center — 7 步执行进度中心
// ============================================================
// 显示：理解需求 → 数据分析 → 自动修复 → 验证计划 →
//      数据执行 → 结果验证 → 智能解释
// 每步有：状态（等待/执行中/完成/失败）、耗时、详情
// ============================================================

'use client';

import { PlanStep, StepStatus } from '@/lib/types';

interface ExecutionCenterProps {
  steps: PlanStep[];
  timing?: Record<string, number>;
  isRunning: boolean;
}

const STEP_ICONS: Record<string, string> = {
  'step-1': '🔍',
  'step-2': '📋',
  'step-3': '🔧',
  'step-4': '✅',
  'step-5': '⚡',
  'step-6': '🔬',
  'step-7': '💡',
};

export default function ExecutionCenter({ steps, timing, isRunning }: ExecutionCenterProps) {
  if (!steps || steps.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-100 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
        </div>
        <p className="text-xs text-zinc-400">提交指令后，执行过程将在此处展示</p>
      </div>
    );
  }

  const completedCount = steps.filter(s => s.status === 'completed').length;
  const allDone = completedCount === steps.length;

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-800">
            {allDone ? '执行完成' : `执行进度 (${completedCount}/${steps.length})`}
          </span>
          {allDone && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✓ 完成</span>
          )}
        </div>
        {isRunning && (
          <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">执行中...</span>
        )}
      </div>

      {/* Step pipeline */}
      <div className="relative">
        {steps.map((step, i) => (
          <div key={step.id} className="relative flex items-start gap-3 pb-4">
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className={`absolute left-3 top-6 w-[1.5px] h-[calc(100%-16px)] ${
                step.status === 'completed' ? 'bg-green-300' : 'bg-zinc-200'
              }`} />
            )}

            {/* Icon / status circle */}
            <StepIcon status={step.status} />

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${
                  step.status === 'completed' ? 'text-green-700' :
                  step.status === 'executing' ? 'text-blue-700' :
                  step.status === 'failed' ? 'text-red-700' :
                  'text-zinc-400'
                }`}>
                  {step.description}
                </span>
                {timing && timing[step.id] !== undefined && (
                  <span className="text-[10px] text-zinc-400">{timing[step.id]}ms</span>
                )}
              </div>

              {/* Sub-items */}
              {step.subItems && step.subItems.length > 0 && (step.status === 'completed' || step.status === 'failed') && (
                <div className="mt-1.5 space-y-0.5">
                  {step.subItems.map((si, j) => (
                    <div key={j} className="flex items-start gap-1.5 text-[11px] text-zinc-500">
                      <span className="shrink-0 text-zinc-400">{si.label}:</span>
                      <span className="text-zinc-700 font-medium">{String(si.value)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Error detail */}
              {step.status === 'failed' && step.details && (
                <p className="mt-1 text-[11px] text-red-600 bg-red-50 rounded px-2 py-1">{step.details}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return (
      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    );
  }
  if (status === 'executing') {
    return (
      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="3">
          <path d="M12 2a10 10 0 1010 10"/>
        </svg>
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
      <div className="w-2 h-2 rounded-full bg-zinc-300" />
    </div>
  );
}
