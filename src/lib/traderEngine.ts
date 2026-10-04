/**
 * TraderRoundEngine - Authoritative Game Simulation Engine for Trader.
 * 
 * Separates core simulation logic from rendering:
 * - One Authoritative Round
 * - Deterministic PRNG and Seeded Trajectories
 * - Organic non-monotonic market movement (rises, dips, pullbacks, momentum)
 * - Positive-only multiplier (floor >= 0.10x, never negative, NaN, or Infinity)
 * - Authoritative crash determination and position settlement
 */

import { RoundPhase, SlotId, TrajectoryPoint } from '@/types/trader';

export interface RoundEngineConfig {
  seed?: string | number;
  customCrash?: number;
  bettingDuration?: number;
}

export interface RoundState {
  roundId: string;
  seed: string;
  phase: RoundPhase;
  elapsedSeconds: number;
  currentMultiplier: number;
  crashMultiplier: number;
  durationSeconds: number;
  trajectory: TrajectoryPoint[];
  crashedAt: number | null;
  settledAt: number | null;
}

// PRNG: 32-bit Mulberry PRNG for deterministic, reproducible simulation runs
export function createPRNG(seedVal: string | number): () => number {
  let s = 0;
  if (typeof seedVal === 'number') {
    s = seedVal >>> 0;
  } else {
    for (let i = 0; i < seedVal.length; i++) {
      s = (s * 31 + seedVal.charCodeAt(i)) >>> 0;
    }
  }
  if (s === 0) s = 123456789;

  return function nextRandom() {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function calculateAuthoritativeDuration(crash: number, rng?: () => number): number {
  const r = rng ? rng() : 0.5;
  if (crash <= 1.05) return Number((0.8 + r * 0.4).toFixed(2));
  if (crash <= 1.25) return Number((1.5 + r * 0.8).toFixed(2));

  const doublings = Math.log2(Math.max(1.01, crash));
  const base = 2.2 + doublings * 3.4;
  return Number(Math.max(1.4, base).toFixed(2));
}

export class TraderRoundEngine {
  private roundId: string;
  private seed: string;
  private rng: () => number;
  private phase: RoundPhase;
  private elapsedSeconds: number;
  private currentMultiplier: number;
  private crashMultiplier: number;
  private durationSeconds: number;
  private trajectory: TrajectoryPoint[];
  private crashedAt: number | null;
  private settledAt: number | null;

  // Canonical pre-computed stochastic path for frame-rate independence and 100% determinism
  private canonicalPath: TrajectoryPoint[];

  constructor(config?: RoundEngineConfig) {
    this.roundId = `round_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.seed = config?.seed ? String(config.seed) : `trader_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this.rng = createPRNG(this.seed);
    this.phase = 'BETTING';
    this.elapsedSeconds = 0;
    this.currentMultiplier = 1.0;
    this.crashedAt = null;
    this.settledAt = null;
    this.trajectory = [{ t: 0, multiplier: 1.0 }];

    // 1. Generate Crash Multiplier
    if (config?.customCrash && config.customCrash >= 1.0) {
      this.crashMultiplier = Number(config.customCrash.toFixed(2));
    } else {
      this.crashMultiplier = this.generateCrashMultiplier();
    }

    // 2. Authoritative Round Duration (single source of truth)
    this.durationSeconds = calculateAuthoritativeDuration(this.crashMultiplier, this.rng);

    // 3. Build Organic Seeded Stochastic Market Trajectory
    this.canonicalPath = this.generateStochasticPath();
  }

  /**
   * Generates crash multiplier based on industry-standard crash distribution
   */
  private generateCrashMultiplier(): number {
    const r = this.rng();

    if (r < 0.08) {
      // Instant crash: 1.00x - 1.12x
      return Number((1.0 + this.rng() * 0.12).toFixed(2));
    } else if (r < 0.50) {
      // Low bracket: 1.13x - 2.00x
      return Number((1.13 + this.rng() * 0.87).toFixed(2));
    } else if (r < 0.82) {
      // Medium bracket: 2.01x - 5.00x
      return Number((2.01 + this.rng() * 2.99).toFixed(2));
    } else if (r < 0.96) {
      // High bracket: 5.01x - 16.00x
      return Number((5.01 + this.rng() * 10.99).toFixed(2));
    } else {
      // Moonshot bracket: 16.01x - 60.00x
      return Number((16.01 + this.rng() * 43.99).toFixed(2));
    }
  }

  /**
   * Generates a deterministic stochastic market path using:
   * - Momentum persistence
   * - Seeded pseudo-random shocks
   * - Volatility regimes
   * - Mean-reversion to baseline trend
   * - Directional drift
   * - Hard positive floor (0.10x, allowing dips below 1.00x)
   * - Terminal locking to crashMultiplier at durationSeconds
   */
  private generateStochasticPath(): TrajectoryPoint[] {
    const path: TrajectoryPoint[] = [{ t: 0, multiplier: 1.0 }];
    const dt = 0.05; // 50ms canonical simulation steps
    const numSteps = Math.max(10, Math.round(this.durationSeconds / dt));

    let currentMult = 1.0;
    let velocity = 0.0;
    const momentumPersistence = 0.78 + this.rng() * 0.12;
    const baseVol = 0.035 + this.rng() * 0.035;
    let regime = 1.0;

    for (let k = 1; k <= numSteps; k++) {
      const t = Number(((k / numSteps) * this.durationSeconds).toFixed(3));
      const progress = k / numSteps;

      // Occasional volatility regime shifts
      if (this.rng() < 0.08) {
        regime = 0.6 + this.rng() * 1.6;
      }

      // Target trend line at this progress
      const targetTrend = 1.0 + (this.crashMultiplier - 1.0) * Math.pow(progress, 1.25);

      // Seeded random shock (in [-1, 1])
      const shock = (this.rng() * 2 - 1) * baseVol * regime;

      // Directional drift & mean reversion toward trend
      const drift = (targetTrend - currentMult) * 0.22;
      const meanReversion = (targetTrend - currentMult) * 0.14;

      // Momentum update
      velocity = velocity * momentumPersistence + shock + drift + meanReversion;

      currentMult += velocity;

      // Preserve existing positive floor of 0.10x (allows dips below 1.00x like 0.95x, 0.90x, etc.)
      currentMult = Math.max(0.10, currentMult);

      // Terminal bridge: smoothly converge to exact crashMultiplier as progress -> 1.0
      if (progress > 0.85) {
        const blend = (progress - 0.85) / 0.15;
        currentMult = currentMult * (1 - blend) + this.crashMultiplier * blend;
      }

      const pointVal = k === numSteps ? this.crashMultiplier : Number(currentMult.toFixed(2));
      path.push({ t, multiplier: pointVal });
    }

    return path;
  }

  /**
   * Computes the non-monotonic multiplier at time `t` via interpolation
   * of the pre-computed canonical stochastic path.
   * Frame-rate independent: identical at 60 FPS, 120 FPS, or headless tests.
   */
  public computeMultiplierAtTime(t: number): number {
    if (t <= 0) return 1.0;
    if (t >= this.durationSeconds) return this.crashMultiplier;

    // Binary search or linear search in canonicalPath
    const path = this.canonicalPath;
    let low = 0;
    let high = path.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (path[mid].t <= t) {
        if (mid === path.length - 1 || path[mid + 1].t > t) {
          const p1 = path[mid];
          const p2 = path[mid + 1] || p1;
          const span = p2.t - p1.t;
          const alpha = span > 0 ? (t - p1.t) / span : 0;
          let val = p1.multiplier + (p2.multiplier - p1.multiplier) * alpha;

          if (isNaN(val) || !isFinite(val)) val = 1.0;
          return Math.max(0.10, Number(val.toFixed(2)));
        }
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return this.crashMultiplier;
  }

  // --- LIFECYCLE METHODS ---

  public startBetting(): RoundState {
    this.phase = 'BETTING';
    this.elapsedSeconds = 0;
    this.currentMultiplier = 1.0;
    this.crashedAt = null;
    this.settledAt = null;
    this.trajectory = [{ t: 0, multiplier: 1.0 }];
    return this.getState();
  }

  public startLive(): RoundState {
    this.phase = 'LIVE';
    this.elapsedSeconds = 0;
    this.currentMultiplier = 1.0;
    this.trajectory = [{ t: 0, multiplier: 1.0 }];
    return this.getState();
  }

  /**
   * Advances the round simulation by elapsed seconds
   */
  public tickTo(elapsed: number): { state: RoundState; crashedJustNow: boolean } {
    if (this.phase !== 'LIVE') {
      return { state: this.getState(), crashedJustNow: false };
    }

    this.elapsedSeconds = Math.max(0, elapsed);

    // Check crash condition
    if (this.elapsedSeconds >= this.durationSeconds) {
      this.currentMultiplier = this.crashMultiplier;
      this.trajectory.push({ t: this.durationSeconds, multiplier: this.crashMultiplier });
      this.phase = 'CRASHED';
      this.crashedAt = Date.now();
      return { state: this.getState(), crashedJustNow: true };
    }

    const mult = this.computeMultiplierAtTime(this.elapsedSeconds);
    this.currentMultiplier = mult;

    // Append to trajectory buffer if elapsed changed significantly (> 0.05s)
    const lastPoint = this.trajectory[this.trajectory.length - 1];
    if (!lastPoint || this.elapsedSeconds - lastPoint.t >= 0.05) {
      this.trajectory.push({ t: this.elapsedSeconds, multiplier: mult });
    }

    return { state: this.getState(), crashedJustNow: false };
  }

  /**
   * Authoritative cashout execution
   */
  public cashout(slotId: SlotId, betAmount: number): {
    success: boolean;
    multiplier: number;
    payout: number;
    reason?: string;
  } {
    if (this.phase !== 'LIVE') {
      return {
        success: false,
        multiplier: 0,
        payout: 0,
        reason: `INVALID_PHASE_${this.phase}`,
      };
    }

    const multiplier = this.currentMultiplier;
    const payout = Number((betAmount * multiplier).toFixed(2));

    return {
      success: true,
      multiplier,
      payout,
    };
  }

  public crash(): RoundState {
    if (this.phase === 'LIVE') {
      this.phase = 'CRASHED';
      this.currentMultiplier = this.crashMultiplier;
      this.crashedAt = Date.now();
      this.trajectory.push({ t: this.durationSeconds, multiplier: this.crashMultiplier });
    }
    return this.getState();
  }

  public settle(): RoundState {
    this.phase = 'SETTLED';
    this.settledAt = Date.now();
    return this.getState();
  }

  // --- ACCESSORS ---

  public getState(): RoundState {
    return {
      roundId: this.roundId,
      seed: this.seed,
      phase: this.phase,
      elapsedSeconds: this.elapsedSeconds,
      currentMultiplier: this.currentMultiplier,
      crashMultiplier: this.crashMultiplier,
      durationSeconds: this.durationSeconds,
      trajectory: [...this.trajectory],
      crashedAt: this.crashedAt,
      settledAt: this.settledAt,
    };
  }

  public getCurrentMultiplier(): number {
    return this.currentMultiplier;
  }

  public getCrashMultiplier(): number {
    return this.crashMultiplier;
  }

  public getPhase(): RoundPhase {
    return this.phase;
  }

  public getRoundId(): string {
    return this.roundId;
  }

  public getSeed(): string {
    return this.seed;
  }

  public getDurationSeconds(): number {
    return this.durationSeconds;
  }

  public getTrajectory(): TrajectoryPoint[] {
    return this.trajectory;
  }
}
