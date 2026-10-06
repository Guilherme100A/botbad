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
  private probeInFlight = false;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  canExecute(): boolean {
    if (this.state === 'closed') return true;

    if (this.state === 'open') {
      if (Date.now() - this.lastFailureAt >= this.config.resetTimeoutMs) {
        this.state = 'half-open';
        this.probeInFlight = true;
        return true;
      }
      return false;
    }

    // half-open: exactly one probe at a time; everyone else falls back until it reports.
    if (this.probeInFlight) return false;
    this.probeInFlight = true;
    return true;
  }

  /** The caller got the probe slot but never called the engine (e.g. no budget): hand the slot back. */
  abandonProbe(): void {
    this.probeInFlight = false;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.probeInFlight = false;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureAt = Date.now();
    this.probeInFlight = false;

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
    this.probeInFlight = false;
  }
}

export const jevCircuitBreaker = new CircuitBreaker();
