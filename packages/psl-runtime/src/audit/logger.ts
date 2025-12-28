export interface AuditEntry {
  id?: string;
  action: string;
  userId?: string;
  tenantId?: string;
  timestamp: string;
  requestId?: string;
  duration?: number;
  status: 'success' | 'failure';
  input?: unknown;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditConfig {
  enabled: boolean;
  retentionDays?: number;
  sensitiveFields?: string[];
  excludeActions?: string[];
  onLog?: (entry: AuditEntry) => void | Promise<void>;
}

export class AuditLogger {
  private config: AuditConfig;
  private buffer: AuditEntry[] = [];
  private bufferSize = 100;

  constructor(config: AuditConfig) {
    this.config = config;
  }

  async log(entry: AuditEntry): Promise<void> {
    if (!this.config.enabled) return;

    // Skip excluded actions
    if (this.config.excludeActions?.includes(entry.action)) {
      return;
    }

    // Sanitize sensitive fields
    const sanitized = this.sanitize(entry);

    // Add ID and ensure timestamp
    sanitized.id = sanitized.id || generateAuditId();
    sanitized.timestamp = sanitized.timestamp || new Date().toISOString();

    // Buffer or immediate log
    if (this.config.onLog) {
      await this.config.onLog(sanitized);
    } else {
      this.buffer.push(sanitized);

      if (this.buffer.length >= this.bufferSize) {
        await this.flush();
      }
    }
  }

  async flush(): Promise<AuditEntry[]> {
    const entries = [...this.buffer];
    this.buffer = [];
    return entries;
  }

  private sanitize(entry: AuditEntry): AuditEntry {
    const sanitized = { ...entry };
    const sensitiveFields = this.config.sensitiveFields || [];

    if (sanitized.input && typeof sanitized.input === 'object') {
      sanitized.input = this.redactFields(
        sanitized.input as Record<string, unknown>,
        sensitiveFields
      );
    }

    if (sanitized.output && typeof sanitized.output === 'object') {
      sanitized.output = this.redactFields(
        sanitized.output as Record<string, unknown>,
        sensitiveFields
      );
    }

    return sanitized;
  }

  private redactFields(
    obj: Record<string, unknown>,
    fields: string[]
  ): Record<string, unknown> {
    const result = { ...obj };

    for (const field of fields) {
      if (field in result) {
        result[field] = '[REDACTED]';
      }
    }

    return result;
  }
}

function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `aud_${timestamp}${random}`;
}

// Singleton for simple usage
let defaultLogger: AuditLogger | null = null;

export function auditLog(entry: AuditEntry): void {
  if (!defaultLogger) {
    defaultLogger = new AuditLogger({
      enabled: true,
      onLog: (e) => {
        // Default: log to console in development
        if (process.env.NODE_ENV !== 'production') {
          console.log('[AUDIT]', JSON.stringify(e));
        }
      },
    });
  }
  defaultLogger.log(entry);
}
