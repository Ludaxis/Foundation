export interface MetricEvent {
  name: string;
  category: 'user' | 'system' | 'business' | 'error';
  properties?: Record<string, unknown>;
  timestamp?: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
}

export interface MetricDimensions {
  [key: string]: string | number | boolean | undefined;
}

export interface MetricsConfig {
  enabled: boolean;
  flushInterval?: number;
  onFlush?: (events: MetricEvent[]) => void | Promise<void>;
}

export class MetricsTracker {
  private config: MetricsConfig;
  private buffer: MetricEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: MetricsConfig) {
    this.config = config;

    if (config.enabled && config.flushInterval) {
      this.startFlushTimer();
    }
  }

  track(event: MetricEvent): void {
    if (!this.config.enabled) return;

    const fullEvent: MetricEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    this.buffer.push(fullEvent);
  }

  trackAction(
    action: string,
    options: {
      userId?: string;
      tenantId?: string;
      duration?: number;
      success?: boolean;
      properties?: Record<string, unknown>;
    }
  ): void {
    this.track({
      name: `action.${action}`,
      category: 'user',
      userId: options.userId,
      tenantId: options.tenantId,
      properties: {
        ...options.properties,
        duration: options.duration,
        success: options.success ?? true,
      },
    });
  }

  trackError(
    error: Error,
    options: {
      action?: string;
      userId?: string;
      tenantId?: string;
    } = {}
  ): void {
    this.track({
      name: 'error',
      category: 'error',
      userId: options.userId,
      tenantId: options.tenantId,
      properties: {
        action: options.action,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      },
    });
  }

  increment(
    metric: string,
    value = 1,
    dimensions?: MetricDimensions
  ): void {
    this.track({
      name: metric,
      category: 'system',
      properties: {
        _type: 'counter',
        _value: value,
        ...dimensions,
      },
    });
  }

  gauge(
    metric: string,
    value: number,
    dimensions?: MetricDimensions
  ): void {
    this.track({
      name: metric,
      category: 'system',
      properties: {
        _type: 'gauge',
        _value: value,
        ...dimensions,
      },
    });
  }

  histogram(
    metric: string,
    value: number,
    dimensions?: MetricDimensions
  ): void {
    this.track({
      name: metric,
      category: 'system',
      properties: {
        _type: 'histogram',
        _value: value,
        ...dimensions,
      },
    });
  }

  async flush(): Promise<MetricEvent[]> {
    const events = [...this.buffer];
    this.buffer = [];

    if (this.config.onFlush && events.length > 0) {
      await this.config.onFlush(events);
    }

    return events;
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(
      () => this.flush(),
      this.config.flushInterval
    );
  }

  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}
