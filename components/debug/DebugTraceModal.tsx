'use client';

import { type PipelineTrace } from '@/lib/pipeline-trace';

interface DebugTraceModalProps {
  trace: PipelineTrace;
  onClose: () => void;
}

export default function DebugTraceModal({ trace, onClose }: DebugTraceModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-[760px] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-zinc-800">🧪 Pipeline Trace</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              trace.path === 'AI' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {trace.path === 'AI' ? '🤖 AI 路径' : '⚙️ 规则路径'}
            </span>
            <span className="text-[11px] text-zinc-400">{trace.id}</span>
          </div>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">
            关闭
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4 font-mono text-[12px] leading-relaxed text-zinc-700">

          {/* ── 1. Path Summary ── */}
          <Section title="Path">
            <Row label="路径">{trace.path === 'AI' ? 'AI 理解路径' : '规则降级路径'}</Row>
            <Row label="AI 是否调用">{trace.aiUsed ? '是' : '否'}</Row>
            <Row label="AI 是否可用">{trace.aiAvailable ? '是' : '否'}</Row>
            {trace.aiError && <Row label="AI 错误">{trace.aiError}</Row>}
            <Row label="输入">{trace.userInput}</Row>
          </Section>

          {/* ── 2. Per-step Timeline ── */}
          <Section title="Stage Timeline">
            <div className="space-y-1.5">
              {trace.steps.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    s.status === 'ok' ? 'bg-green-100 text-green-700' :
                    s.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-zinc-100 text-zinc-400'
                  }`}>
                    {s.status === 'ok' ? '✓' : s.status === 'failed' ? '✗' : '−'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-zinc-800">{s.stage}</span>
                    <span className="text-zinc-400 mx-1">·</span>
                    <span>{s.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── 3. AI Output ── */}
          {trace.aiTaskPlan && (
            <Section title="AI 原始输出 (TaskPlan)">
              <pre className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(trace.aiTaskPlan, null, 2)}
              </pre>
            </Section>
          )}

          {/* ── 4. Rule Output ── */}
          {trace.ruleTaskPlan && (
            <Section title="规则解析输出 (TaskPlan)">
              <pre className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(trace.ruleTaskPlan, null, 2)}
              </pre>
            </Section>
          )}

          {/* ── 5. Schema Resolution ── */}
          {trace.schemaResolverUsed && trace.schemaResolution && (
            <Section title="Schema Resolver (列映射)">
              <pre className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(trace.schemaResolution, null, 2)}
              </pre>
            </Section>
          )}

          {/* ── 6. Compilation ── */}
          <Section title="Compiler (TaskPlan → ExecutionPlan)">
            <Row label="列被修改">{trace.compilerModifiedColumns ? '是' : '否'}</Row>
            {trace.compilerError && <Row label="编译器错误">{trace.compilerError}</Row>}
          </Section>

          {/* ── 7. Final Plan ── */}
          {trace.finalExecutionPlan && (
            <Section title="最终 ExecutionPlan">
              <pre className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre-wrap">
                {typeof trace.finalExecutionPlan === 'string'
                  ? trace.finalExecutionPlan
                  : JSON.stringify(trace.finalExecutionPlan, null, 2)}
              </pre>
            </Section>
          )}

          {/* ── 8. Engine Dispatch ── */}
          <Section title="Engine 分发">
            <Row label="执行引擎">
              {trace.enginePath === 'V2' ? 'V2 Executor Registry' :
               trace.enginePath === 'V1_LEGACY' ? '旧引擎 ExecutionEngine.execute()' : '跳过'}
            </Row>
            <Row label="操作类型">{trace.finalOperation}</Row>
            <Row label="置信度">{(trace.confidence * 100).toFixed(0)}%</Row>
            <Row label="执行成功">{trace.executionSuccess ? '是' : '否'}</Row>
            {trace.executionError && <Row label="错误">{trace.executionError}</Row>}
            <Row label="处理前">{trace.rowsBefore ?? '-'} 行</Row>
            <Row label="处理后">{trace.rowsAfter ?? '-'} 行</Row>
          </Section>

          {/* ── 9. Verification ── */}
          {trace.verificationPassed !== undefined && (
            <Section title="Verification">
              <Row label="验证通过">{trace.verificationPassed ? '是' : '否'}</Row>
              {trace.verificationChecks && trace.verificationChecks.map((c, i) => (
                <Row key={i} label={c.name}>{c.passed ? `✓ ${c.detail}` : `✗ ${c.detail}`}</Row>
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">{title}</div>
      <div className="space-y-1 pl-1">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-zinc-400 shrink-0 w-20 text-right text-[11px]">{label}</span>
      <span className="text-zinc-800">{children}</span>
    </div>
  );
}
