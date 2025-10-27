/**
 * Structured Logging Utility
 *
 * Production-ready logger with support for different log levels
 * Replaces 95+ console.log statements throughout the codebase
 */

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  TRACE = 'trace',
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text';
  includeTimestamp: boolean;
  includeContext: boolean;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp?: string;
  context?: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger class
 */
export class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      format: 'json',
      includeTimestamp: true,
      includeContext: true,
      ...config,
    };
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.TRACE, LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const configLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= configLevelIndex;
  }

  /**
   * Format log entry
   */
  private formatLogEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry);
    }

    let output = `[${entry.level.toUpperCase()}]`;

    if (this.config.includeTimestamp && entry.timestamp) {
      output += ` ${entry.timestamp}`;
    }

    if (this.config.includeContext && entry.context) {
      output += ` [${entry.context}]`;
    }

    output += ` ${entry.message}`;

    if (entry.data && Object.keys(entry.data).length > 0) {
      output += ` ${JSON.stringify(entry.data)}`;
    }

    if (entry.error) {
      output += `\nError: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n${entry.error.stack}`;
      }
    }

    return output;
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, any>,
    error?: Error,
    context?: string
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: this.config.includeTimestamp ? new Date().toISOString() : undefined,
      context: context || 'WBGT',
      data: data && Object.keys(data).length > 0 ? data : undefined,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Output formatted log
    const formatted = this.formatLogEntry(entry);
    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  /**
   * Trace level logging
   */
  public trace(message: string, data?: Record<string, any>, context?: string): void {
    this.log(LogLevel.TRACE, message, data, undefined, context);
  }

  /**
   * Debug level logging
   */
  public debug(message: string, data?: Record<string, any>, context?: string): void {
    this.log(LogLevel.DEBUG, message, data, undefined, context);
  }

  /**
   * Info level logging
   */
  public info(message: string, data?: Record<string, any>, context?: string): void {
    this.log(LogLevel.INFO, message, data, undefined, context);
  }

  /**
   * Warn level logging
   */
  public warn(message: string, data?: Record<string, any>, context?: string): void {
    this.log(LogLevel.WARN, message, data, undefined, context);
  }

  /**
   * Error level logging
   */
  public error(message: string, error?: Error, data?: Record<string, any>, context?: string): void {
    this.log(LogLevel.ERROR, message, data, error, context);
  }

  /**
   * Get log buffer
   */
  public getBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Clear log buffer
   */
  public clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

/**
 * Get or create global logger
 */
export function getLogger(config?: Partial<LoggerConfig>): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(config);
  }
  return globalLogger;
}

/**
 * Create a named logger
 */
export function createLogger(name: string, config?: Partial<LoggerConfig>): Logger {
  const logger = new Logger(config);
  const originalLog = logger.trace.bind(logger);

  return {
    ...logger,
    trace: (message: string, data?: Record<string, any>) =>
      originalLog(message, data, name),
    debug: (message: string, data?: Record<string, any>) =>
      logger.debug(message, data, name),
    info: (message: string, data?: Record<string, any>) =>
      logger.info(message, data, name),
    warn: (message: string, data?: Record<string, any>) =>
      logger.warn(message, data, name),
    error: (message: string, error?: Error, data?: Record<string, any>) =>
      logger.error(message, error, data, name),
  } as Logger;
}

/**
 * Log function execution time
 */
export function logExecutionTime(
  logger: Logger,
  functionName: string,
  duration: number,
  context?: string
): void {
  if (duration > 1000) {
    logger.warn(`${functionName} took ${duration}ms (slow execution)`, { duration }, context);
  } else {
    logger.debug(`${functionName} completed in ${duration}ms`, { duration }, context);
  }
}

/**
 * Singleton logger export for convenience
 */
export const logger = getLogger({
  level: LogLevel.INFO,
  format: 'json',
  includeTimestamp: true,
  includeContext: true,
});
