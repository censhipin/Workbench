'use client';

import { ResultSummary as ResultSummaryType } from '@/lib/types';
import Badge from '@/components/common/Badge';

interface ResultSummaryProps {
  summary: ResultSummaryType;
}

export default function ResultSummary({ summary }: ResultSummaryProps) {
  return (
    <div className="px-3 py-3 border-b border-zinc-100">
      <div className="flex items-center gap-2 mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 shrink-0">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span className="text-sm font-semibold text-zinc-800">处理结果</span>
      </div>

      {/* 总览统计 */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {summary.totalRecords !== undefined && (
          <div className="bg-zinc-50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-zinc-400">总记录</p>
            <p className="text-sm font-semibold text-zinc-800">{summary.totalRecords}</p>
          </div>
        )}
        {summary.matchedCount !== undefined && (
          <div className="bg-emerald-50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-emerald-600">成功匹配</p>
            <p className="text-sm font-semibold text-emerald-700">{summary.matchedCount}</p>
          </div>
        )}
        {summary.unmatchedCount !== undefined && (
          <div className="bg-amber-50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-amber-600">未匹配</p>
            <p className="text-sm font-semibold text-amber-700">{summary.unmatchedCount}</p>
          </div>
        )}
        {summary.deletedCount !== undefined && (
          <div className="bg-red-50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-red-600">已删除</p>
            <p className="text-sm font-semibold text-red-700">{summary.deletedCount}</p>
          </div>
        )}
        {summary.modifiedCount !== undefined && (
          <div className="bg-blue-50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-blue-600">已修改</p>
            <p className="text-sm font-semibold text-blue-700">{summary.modifiedCount}</p>
          </div>
        )}
      </div>

      {/* 详细变更 */}
      {summary.details && summary.details.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-zinc-400 mb-1">变更明细</p>
          {summary.details.map((detail, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-zinc-50 text-xs"
            >
              <span className="text-zinc-600 truncate flex-1">{detail.label}</span>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                {detail.before !== detail.after ? (
                  <>
                    <span className="text-zinc-400 line-through">
                      {detail.before}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-300">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                    <span className="text-emerald-600 font-medium">
                      {detail.after}
                    </span>
                    {detail.deleted > 0 && (
                      <span className="text-[10px] text-red-500">
                        -{detail.deleted}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-zinc-400">{detail.before}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
