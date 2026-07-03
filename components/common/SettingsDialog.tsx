'use client';

import { useState, useEffect, useRef } from 'react';
import { getApiKey, setApiKey } from '@/lib/api-key';

export type SettingsMode = 'settings' | 'execute' | 'audit';

interface SettingsDialogProps {
  onClose: () => void;
  mode?: SettingsMode;
  onSaved?: () => void;
}

const MODE_CONFIG: Record<SettingsMode, {
  title: string;
  icon: string;
  description: string;
  features: string[];
  buttonText: string;
}> = {
  settings: {
    title: '设置',
    icon: '⚙️',
    description: '配置 DeepSeek API Key 以启用 AI 数据理解功能',
    features: [
      '用自然语言指令处理表格数据',
      '智能筛选、排序、统计、公式计算',
      '多表匹配与数据质量检测',
    ],
    buttonText: '保存',
  },
  execute: {
    title: '执行任务需要 API Key',
    icon: '🤖',
    description: '执行任务需要通过 DeepSeek AI 理解你的自然语言指令，请先配置 API Key。',
    features: [
      '输入"筛选部门是技术部工资大于10000的数据"',
      '输入"按基本工资降序排序"',
      '输入"统计每个部门的平均工资"',
    ],
    buttonText: '保存并执行',
  },
  audit: {
    title: '数据检测需要 API Key',
    icon: '🔍',
    description: '数据检测需要通过 DeepSeek AI 分析数据质量、识别异常值和重复数据。',
    features: [
      '自动检测空白值和异常数据',
      '识别重复记录',
      '提供数据修复建议',
    ],
    buttonText: '保存并检测',
  },
};

export default function SettingsDialog({ onClose, mode = 'settings', onSaved }: SettingsDialogProps) {
  const [keyValue, setKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const config = MODE_CONFIG[mode];

  useEffect(() => {
    setKeyValue(getApiKey());
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSave = () => {
    const trimmed = keyValue.trim();
    if (!trimmed) {
      setError('请输入 API Key');
      return;
    }
    if (!trimmed.startsWith('sk-')) {
      setError('API Key 格式不正确，应以 sk- 开头');
      return;
    }
    setError('');
    setApiKey(trimmed);
    setSaved(true);
    setTimeout(() => {
      if (onSaved) onSaved();
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-zinc-200 w-[440px] max-w-[92vw] overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 pt-6 pb-5 border-b border-zinc-100">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center text-lg shrink-0 mt-0.5">
              {config.icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-zinc-800">{config.title}</h3>
              <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{config.description}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Features list */}
          <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">支持的功能</h4>
            <ul className="space-y-1.5">
              {config.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-zinc-600">
                  <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f6ef7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              DeepSeek API Key
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showKey ? 'text' : 'password'}
                value={keyValue}
                onChange={(e) => {
                  setKeyValue(e.target.value);
                  setError('');
                }}
                placeholder="sk-..."
                className="w-full text-sm px-3.5 py-2.5 pr-10 rounded-xl border border-zinc-300 bg-white text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors p-0.5"
                tabIndex={-1}
              >
                {showKey ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </p>
            )}
            {saved && (
              <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1 transition-all">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                已保存
              </p>
            )}
          </div>

          {/* Tips */}
          <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-100">
            <div className="flex items-start gap-2.5">
              <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <div className="text-xs text-amber-700 leading-relaxed">
                首次使用请前往 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 hover:text-amber-800">platform.deepseek.com</a> 注册并获取 API Key。Key 会保存在浏览器本地，下次无需重复输入。
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-end gap-2.5 bg-zinc-50/50">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-white hover:shadow-sm transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="text-sm px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 hover:shadow-sm transition-all font-medium"
          >
            {config.buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
