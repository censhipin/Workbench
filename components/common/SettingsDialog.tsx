'use client';

import { useState, useEffect, useRef } from 'react';
import { getApiKey, setApiKey } from '@/lib/api-key';
import {
  getDebugEnabled, setDebugEnabled,
  getTheme, setTheme,
  clearAllData, THEMES,
} from '@/lib/settings';

export type SettingsMode = 'settings' | 'execute' | 'audit';

type TabId = 'api' | 'appearance' | 'about' | 'data';

interface TabItem {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabItem[] = [
  { id: 'api', label: 'API 配置', icon: '⚙️' },
  { id: 'appearance', label: '界面设置', icon: '🎨' },
  { id: 'about', label: '关于', icon: 'ℹ️' },
  { id: 'data', label: '数据管理', icon: '🗑️' },
];

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
    description: '配置 API 及个性化设置',
    features: [],
    buttonText: '保存',
  },
  execute: {
    title: '执行任务需要 API Key',
    icon: '🤖',
    description: '执行任务需要通过 AI 理解你的自然语言指令，请先配置 API Key。',
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
    description: '数据检测需要通过 AI 分析数据质量、识别异常值和重复数据。',
    features: [
      '自动检测空白值和异常数据',
      '识别重复记录',
      '提供数据修复建议',
    ],
    buttonText: '保存并检测',
  },
};

export default function SettingsDialog({ onClose, mode = 'settings', onSaved }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>('api');
  const [keyValue, setKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [debugEnabled, setDebugEnabledLocal] = useState(false);
  const [themeId, setThemeIdLocal] = useState<string>('default');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const config = MODE_CONFIG[mode];
  const showFeatures = mode !== 'settings' && activeTab === 'api';

  useEffect(() => {
    setKeyValue(getApiKey());
    setDebugEnabledLocal(getDebugEnabled());
    setThemeIdLocal(getTheme());
    setTimeout(() => activeTab === 'api' && inputRef.current?.focus(), 100);
  }, [activeTab]);

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
      setActiveTab('api');
      return;
    }
    if (!trimmed.startsWith('sk-')) {
      setError('API Key 格式不正确，应以 sk- 开头');
      setActiveTab('api');
      return;
    }
    setError('');

    setApiKey(trimmed);
    setDebugEnabled(debugEnabled);
    setTheme(themeId as 'default' | 'warm' | 'sage');

    setSaved(true);
    setTimeout(() => {
      if (onSaved) onSaved();
      onClose();
    }, 500);
  };

  const handleClearData = () => {
    clearAllData();
    setShowClearConfirm(false);
    window.location.reload();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'api':
        return (
          <div className="space-y-4">
            {showFeatures && (
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
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">API Key</label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showKey ? 'text' : 'password'}
                  value={keyValue}
                  onChange={(e) => { setKeyValue(e.target.value); setError(''); }}
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
              <p className="text-[11px] text-zinc-400 mt-1.5">用于 AI 处理自然语言指令的 API 密钥</p>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-zinc-700 mb-2.5">软件主题</p>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map(t => {
                  const isActive = themeId === t.id;
                  const previewColors = t.id === 'default'
                    ? { bg: '#f8f9fa', primary: '#4f6ef7', text: '#1a1a2e' }
                    : t.id === 'warm'
                    ? { bg: '#faf7f2', primary: '#b8784a', text: '#3a3228' }
                    : { bg: '#f4f6f3', primary: '#6d8f6d', text: '#2a3028' };
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setThemeIdLocal(t.id);
                        document.documentElement.setAttribute('data-theme', t.id);
                      }}
                      className="rounded-xl border-2 p-3 transition-all text-left"
                      style={{
                        borderColor: isActive ? previewColors.primary : 'var(--border-color)',
                        background: previewColors.bg,
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: previewColors.primary }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                        </div>
                        <div className="flex gap-0.5">
                          {[previewColors.bg, previewColors.bg, previewColors.bg].map((c, i) => (
                            <div key={i} className="w-3 h-2 rounded-sm" style={{ background: i === 0 ? previewColors.primary : i === 1 ? '#d1d5db' : '#e5e7eb' }} />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs font-medium" style={{ color: previewColors.text }}>{t.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: t.id === 'default' ? '#6b7280' : t.id === 'warm' ? '#8a7e72' : '#6d7a6a' }}>{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-zinc-100" />

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-zinc-700">Debug 模式</p>
                <p className="text-xs text-zinc-400 mt-0.5">开启后在顶栏显示调试按钮</p>
              </div>
              <button
                type="button"
                onClick={() => setDebugEnabledLocal(!debugEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${debugEnabled ? 'bg-blue-600' : 'bg-zinc-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${debugEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 py-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-sm">
                DP
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-800">DataPilot</p>
                <p className="text-sm text-zinc-400 mt-0.5">版本 0.3.2</p>
              </div>
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed">
              通过自然语言指令处理表格数据，支持智能筛选、排序、统计、公式计算，以及多表匹配与数据质量检测。
            </p>
            <div className="border-t border-zinc-100" />
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  (window as any).__checkUpdate?.();
                }
              }}
              className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-all ${
                typeof window !== 'undefined' && window.electronAPI?.isElectron
                  ? 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:shadow-sm'
                  : 'border-zinc-100 text-zinc-300 cursor-not-allowed'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              {typeof window !== 'undefined' && window.electronAPI?.isElectron ? '检查更新' : '桌面客户端可用'}
            </button>
          </div>
        );

      case 'data':
        return (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500 leading-relaxed">
              清除所有本地数据，包括文件缓存、操作历史、API 配置和设置。此操作不可恢复。
            </p>
            {!showClearConfirm ? (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="w-full text-sm px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-all"
              >
                清除所有数据
              </button>
            ) : (
              <div className="bg-red-50 rounded-xl p-4 border border-red-200 space-y-3">
                <p className="text-sm text-red-700 leading-relaxed">
                  此操作将清除所有本地数据（文件缓存、操作历史、设置），且不可恢复。确定继续？
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 text-sm px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-white transition-all"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleClearData}
                    className="flex-1 text-sm px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all"
                  >
                    确认清除
                  </button>
                </div>
              </div>
            )}
            <div className="border-t border-zinc-100 pt-4">
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                所有数据均在本地处理，不上传至外部服务器。
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-zinc-200 w-[640px] max-w-[94vw] overflow-hidden">
        {/* Header */}
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

        {/* Body: Nav + Content */}
        <div className="flex min-h-[320px] max-h-[55vh]">
          {/* Left Nav */}
          <nav className="w-[156px] shrink-0 border-r border-zinc-100 p-3 space-y-1">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setActiveTab(tab.id); setShowClearConfirm(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right Content */}
          <div className="flex-1 px-6 py-5 overflow-y-auto">
            {renderContent()}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-end gap-2.5 bg-zinc-50/50">
          {saved && (
            <span className="text-xs text-emerald-600 flex items-center gap-1 mr-auto">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              已保存
            </span>
          )}
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
