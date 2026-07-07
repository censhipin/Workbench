// ============================================================
// useDialogController — 对话框状态控制器
// ============================================================
import { useState, useCallback } from 'react';

export function useDialogController() {
  const [showAudit, setShowAudit] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiKeyMode, setApiKeyMode] = useState<'settings' | 'execute' | 'audit'>('settings');
  const [errorDialog, setErrorDialog] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  const dismissError = useCallback(() => setErrorDialog(null), []);

  return {
    showAudit, setShowAudit,
    showApiKeyDialog, setShowApiKeyDialog,
    apiKeyMode, setApiKeyMode,
    errorDialog, setErrorDialog,
    debugMode, setDebugMode,
    dismissError,
  };
}
