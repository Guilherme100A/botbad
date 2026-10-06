type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
};

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureAt = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  canExecute(): boolean {
    if (this.state === 'closed') return true;

    if (this.state === 'open') {
      if (Date.now() - this.lastFailureAt >= this.config.resetTimeoutMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }

    // half-open: allow one test call
    return true;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureAt = Date.now();

    if (this.state === 'half-open') {
      this.state = 'open';
      return;
    }

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitState {
    if (this.state === 'open' && Date.now() - this.lastFailureAt >= this.config.resetTimeoutMs) {
      return 'half-open';
    }
    return this.state;
  }

  resetForTesting(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureAt = 0;
  }
}

export const jevCircuitBreaker = new CircuitBreaker();
