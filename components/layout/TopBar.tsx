'use client';

import { useState } from 'react';
import SettingsDialog from '@/components/common/SettingsDialog';

interface TopBarProps {
  fileName?: string | null;
  versionLabel?: string;
  debugMode?: boolean;
  onToggleDebug?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
}

export default function TopBar({ fileName, versionLabel, debugMode, onToggleDebug, onOpenSettings, onOpenHelp }: TopBarProps) {

  return (
    <header className="h-14 shrink-0 border-b border-[#e9ecef] bg-white flex items-center justify-between px-6">
      {/* Left: Logo + Product name */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[#4f6ef7] flex items-center justify-center">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[#1a1a2e]">DataPilot</span>
        </div>

        {/* Center: filename + version */}
        {fileName && (
          <div className="flex items-center gap-2 pl-4 border-l border-[#e9ecef]">
            <span className="text-sm text-[#1a1a2e] font-medium">{fileName}</span>
            {versionLabel && (
              <span className="text-[11px] text-[#6b7280] bg-[#f3f4f6] px-2 py-0.5 rounded-md font-medium">{versionLabel}</span>
            )}
          </div>
        )}
      </div>

      {/* Right: debug + settings + help */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleDebug}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
            debugMode ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'text-[#6b7280] hover:bg-[#f3f4f6]'
          }`}
          title="调试模式"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3"/>
            <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Debug
        </button>
        <button onClick={() => onOpenSettings?.()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          设置
        </button>
        <button onClick={() => onOpenHelp?.()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          帮助
        </button>
      </div>
    </header>
  );
}
