/**
 * Lightweight logger that collects diagnostics for the "Copy diagnostics" feature.
 * Does NOT log PII. All entries are stored in-memory and discarded on page reload.
 */
export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  timestamp: string;
  message: string;
  data?: unknown;
}

class Logger {
  private entries: LogEntry[] = [];
  private readonly prefix = '[BranchPilot]';

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  private log(level: LogEntry['level'], message: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      data,
    };
    this.entries.push(entry);

    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (data !== undefined) {
      consoleMethod(`${this.prefix} [${level.toUpperCase()}] ${message}`, data);
    } else {
      consoleMethod(`${this.prefix} [${level.toUpperCase()}] ${message}`);
    }
  }

  getDiagnostics(): Record<string, unknown> {
    return {
      extensionVersion: '1.0.0',
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      log: this.entries,
    };
  }

  clearDiagnostics(): void {
    this.entries = [];
  }
}

// Singleton
export const logger = new Logger();
