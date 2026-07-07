// ============================================================
// Logger — 统一日志系统
// ============================================================
// 禁止直接使用 console.log/warn/error/debug
// 统一使用 Logger.{info|warn|error|debug}
// ============================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_PREFIX: Record<LogLevel, string> = {
  debug: '[DEBUG]',
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
};

class Logger {
  private minLevel: LogLevel = 'info';
  private enabled = true;

  setLevel(level: LogLevel) {
    this.minLevel = level;
  }

  disable() {
    this.enabled = false;
  }

  enable() {
    this.enabled = true;
  }

  debug(...args: unknown[]) {
    this.log('debug', ...args);
  }

  info(...args: unknown[]) {
    this.log('info', ...args);
  }

  warn(...args: unknown[]) {
    this.log('warn', ...args);
  }

  error(...args: unknown[]) {
    this.log('error', ...args);
  }

  private log(level: LogLevel, ...args: unknown[]) {
    if (!this.enabled) return;
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;

    const prefix = LOG_PREFIX[level];
    const timestamp = new Date().toISOString().slice(11, 23);

    // In production, pipe to a structured sink if needed
    // For now, use the native console
    const fn = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : level === 'debug' ? console.debug
      : console.log;

    fn(`[${timestamp}]${prefix}`, ...args);
  }
}

export const logger = new Logger();
export type { LogLevel };
