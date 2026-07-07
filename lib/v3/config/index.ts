// ============================================================
// Config Center — 统一配置
// ============================================================
// 所有 Magic Number 全部抽离至此
// ============================================================

export const config = {
  // ── Feature Flags ────────────────────────────────────
  feature: {
    enableV2Verifier: true,
    enableV3Profile: true,
    enableV3Repair: true,
    enableV3Explain: true,
    enableV3Workbench: true,
    enableDiffView: false,
    enableDebugMode: false,
  },

  // ── Limits ───────────────────────────────────────────
  limit: {
    maxVersions: 20,
    maxHistoryItems: 50,
    maxTaskFiles: 10,
    maxPipelineSteps: 50,
    maxRowsInPreview: 10000,
    maxColumnsInPreview: 200,
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
    executionAnimationDelayMs: 480,
    executionStepDelayMs: 180,
    debounceMs: 300,
  },

  // ── Thresholds ───────────────────────────────────────
  threshold: {
    confidenceHigh: 0.8,
    confidenceMedium: 0.6,
    confidenceLow: 0.4,
    nullRateWarning: 0.2,      // 20%
    duplicateRateWarning: 0.1,  // 10%
    matchRateWarning: 0.5,      // 50%
    removedPctWarning: 0.8,     // 80%
    emptyResultWarning: 0,      // 0 rows
  },

  // ── Performance ──────────────────────────────────────
  performance: {
    profileEnabled: true,
    slowQueryThresholdMs: 1000,
    animationEnabled: true,
    batchSize: 1000,
  },

  // ── API ──────────────────────────────────────────────
  api: {
    minKeyLength: 10,
    retryCount: 3,
    timeoutMs: 30000,
  },

  // ── UI ───────────────────────────────────────────────
  ui: {
    toastDurationMs: 3000,
    animationDurationMs: 300,
    sidebarWidthDefault: 280,
    rightPanelWidthDefault: 320,
  },
} as const;

export type Config = typeof config;
