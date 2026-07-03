'use client';

import { PlanStep, PlanViewMode } from '@/lib/types';

interface ExecutionPlanProps {
  steps: PlanStep[];
  viewMode: PlanViewMode;
  taskFiles: { id: string; name: string; icon: string }[];
}

export default function ExecutionPlan({ steps, viewMode }: ExecutionPlanProps) {
  if (!steps || steps.length === 0) {
    return (
      <div className="p-6 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
        </svg>
        <p className="text-xs text-[#9ca3af]">暂无执行计划</p>
      </div>
    );
  }

  if (viewMode === 'developer') {
    const planJson = JSON.stringify(
      {
        steps: steps.map(s => ({
          order: s.order,
          operation: s.description,
          status: s.status,
          details: s.details || null,
          isDangerous: s.isDangerous,
        })),
        summary: {
          total: steps.length,
          completed: steps.filter(s => s.status === 'completed').length,
          failed: steps.some(s => s.status === 'failed'),
        },
      },
      null, 2
    );

    return (
      <div className="p-3">
        <pre className="text-[11px] font-mono text-[#6b7280] leading-relaxed overflow-auto max-h-[300px] whitespace-pre rounded-lg bg-white p-3 border border-[#e9ecef]">
          {planJson}
        </pre>
      </div>
    );
  }

  const completedCount = steps.filter(s => s.status === 'completed').length;
  const allCompleted = completedCount === steps.length;

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-[#1a1a2e]">
          {allCompleted ? '执行完成' : `执行计划 (${completedCount}/${steps.length})`}
        </span>
        {allCompleted && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#d1fae5] text-[#059669] font-medium">✓ 完成</span>
        )}
      </div>
      {steps.map((step) => (
        <StepCard key={step.id} step={step} />
      ))}
    </div>
  );
}

function StepCard({ step }: { step: PlanStep }) {
  const status = step.status;
  const isCompleted = status === 'completed';
  const isExecuting = status === 'executing';
  const isFailed = status === 'failed';
  const isWaiting = status === 'waiting';

  const borderColor = isCompleted ? 'border-l-[#059669]' : isExecuting ? 'border-l-[#4f6ef7]' : isFailed ? 'border-l-[#ef4444]' : 'border-l-[#d1d5db]';
  const bgColor = isExecuting ? 'bg-[#eef1ff]' : 'bg-white';

  return (
    <div className={`rounded-lg border border-[#e9ecef] border-l-[3px] ${borderColor} ${bgColor} p-3 transition-all ${isExecuting ? 'shadow-sm' : ''}`}>
      <div className="flex items-start gap-2">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
          isCompleted ? 'bg-[#059669] text-white' :
          isExecuting ? 'bg-[#4f6ef7] text-white' :
          isFailed ? 'bg-[#ef4444] text-white' :
          'bg-[#f3f4f6] text-[#9ca3af]'
        }`}>
          {isCompleted ? '✓' : isExecuting ? <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2a10 10 0 1010 10"/></svg> : isFailed ? '✗' : step.order}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs leading-relaxed ${isCompleted ? 'text-[#6b7280]' : isExecuting ? 'text-[#4f6ef7] font-semibold' : isFailed ? 'text-[#ef4444] font-medium' : 'text-[#9ca3af]'}`}>
            {step.description}
          </p>
          {step.isDangerous && <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-[#fef2f2] text-[#ef4444] font-medium mt-1">危险操作</span>}
          {isExecuting && step.details && <p className="text-[11px] text-[#6b7280] mt-1">{step.details}</p>}
          {isFailed && step.details && <p className="text-[11px] text-[#ef4444] mt-1">{step.details}</p>}
          {(isCompleted || isFailed) && step.subItems && step.subItems.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {step.subItems.map((si, j) => (
                <div key={j} className="flex items-center gap-1.5 text-[11px] text-[#6b7280]">
                  <span className="text-[#9ca3af]">{si.label}</span>
                  <span className="text-[#1a1a2e] font-medium">{String(si.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
