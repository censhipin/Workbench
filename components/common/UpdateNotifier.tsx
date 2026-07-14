'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

type UpdateState =
  | { type: 'idle' }
  | { type: 'available'; version: string }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded' }
  | { type: 'error'; message: string }
  | { type: 'not-available' };

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      onUpdateAvailable: (cb: (v: string) => void) => void;
      onUpdateNotAvailable: (cb: () => void) => void;
      onDownloadProgress: (cb: (pct: number) => void) => void;
      onUpdateDownloaded: (cb: () => void) => void;
      onUpdateError: (cb: (msg: string) => void) => void;
      checkForUpdate: () => void;
      downloadUpdate: () => void;
      installUpdate: () => void;
    };
  }
}

export default function UpdateNotifier() {
  const [state, setState] = useState<UpdateState>({ type: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const notAvailTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.isElectron) return;

    api.onUpdateAvailable((version) => {
      clearTimeout(notAvailTimer.current);
      setState({ type: 'available', version });
      setDismissed(false);
    });

    api.onUpdateNotAvailable(() => {
      setState({ type: 'not-available' });
      setDismissed(false);
      // 3秒后自动收起
      notAvailTimer.current = setTimeout(() => setDismissed(true), 3000);
    });

    api.onDownloadProgress((percent) => {
      setState({ type: 'downloading', percent: Math.round(percent) });
    });

    api.onUpdateDownloaded(() => {
      setState({ type: 'downloaded' });
    });

    api.onUpdateError((msg) => {
      setState({ type: 'error', message: msg });
      setDismissed(false);
    });

    // 监听通过 window.event 触发的手动检查
    const onCheck = () => api.checkForUpdate();
    window.addEventListener('check-update', onCheck, { once: false });

    return () => {
      clearTimeout(notAvailTimer.current);
      window.removeEventListener('check-update', onCheck);
    };
  }, []);

  useEffect(() => {
    // 暴露给 SettingsDialog "检查更新" 点击时调用
    if (typeof window !== 'undefined') {
      (window as any).__checkUpdate = () => {
        setDismissed(false);
        setState({ type: 'idle' });
        window.electronAPI?.checkForUpdate();
      };
    }
  }, []);

  const handleDownload = useCallback(() => {
    window.electronAPI?.downloadUpdate();
  }, []);

  const handleInstall = useCallback(() => {
    window.electronAPI?.installUpdate();
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const handleRetry = useCallback(() => {
    setState({ type: 'idle' });
    window.electronAPI?.checkForUpdate();
  }, []);

  if (dismissed || state.type === 'idle') return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm">
      <div className="rounded-xl shadow-xl border p-4 bg-white" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-light)' }}>
            {state.type === 'downloading' ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
            ) : state.type === 'downloaded' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            ) : state.type === 'not-available' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            ) : state.type === 'error' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {state.type === 'available' && (
              <>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>有新版本 {state.version} 可用</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>点击下方按钮开始下载更新</p>
                <button onClick={handleDownload} className="mt-2.5 text-xs px-3.5 py-1.5 rounded-lg text-white font-medium transition-all" style={{ background: 'var(--primary)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                >下载更新</button>
              </>
            )}
            {state.type === 'downloading' && (
              <>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>正在下载更新...</p>
                <div className="mt-2 w-full h-1.5 rounded-full" style={{ background: 'var(--hover-bg)' }}>
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${state.percent}%`, background: 'var(--primary)' }} />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{state.percent}%</p>
              </>
            )}
            {state.type === 'downloaded' && (
              <>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>更新已下载完成</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>重启应用以完成更新</p>
                <button onClick={handleInstall} className="mt-2.5 text-xs px-3.5 py-1.5 rounded-lg text-white font-medium transition-all" style={{ background: 'var(--primary)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                >立即重启</button>
              </>
            )}
            {state.type === 'not-available' && (
              <>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>已是最新版本</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>当前没有可用更新</p>
              </>
            )}
            {state.type === 'error' && (
              <>
                <p className="text-sm font-medium text-red-600">更新检查失败</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{state.message}</p>
                <button onClick={handleRetry} className="mt-2.5 text-xs px-3.5 py-1.5 rounded-lg border font-medium transition-all" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >重试</button>
              </>
            )}
          </div>
          <button onClick={handleDismiss} className="shrink-0 p-0.5" style={{ color: 'var(--text-tertiary)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
