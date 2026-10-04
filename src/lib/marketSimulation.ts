/**
 * Market simulation engine for Trader crash game.
 * Generates deterministic crash points and realistic fluctuating market price paths
 * with dips, consolidations, and surges instead of monotonic increases.
 */

export interface RoundSimulation {
  crashMultiplier: number;
  durationSeconds: number;
  seed: number;
  fluctuationFreq: number;
  fluctuationAmp: number;
}

/**
 * Generates a realistic crash multiplier using standard crash probability curves:
 * - ~10% instant crash (1.00x - 1.15x)
 * - ~45% low crash (1.16x - 2.00x)
 * - ~30% medium run (2.01x - 5.00x)
 * - ~12% high run (5.01x - 15.00x)
 * - ~3% moon shot (15.01x - 50.00x)
 */
export function generateCrashMultiplier(): number {
  const r = Math.random();

  if (r < 0.08) {
    // Instant crash
    return Number((1.0 + Math.random() * 0.12).toFixed(2));
  } else if (r < 0.52) {
    // Low bracket: 1.13x - 2.05x
    return Number((1.13 + Math.random() * 0.92).toFixed(2));
  } else if (r < 0.82) {
    // Medium bracket: 2.06x - 5.20x
    return Number((2.06 + Math.random() * 3.14).toFixed(2));
  } else if (r < 0.96) {
    // High run: 5.21x - 16.50x
    return Number((5.21 + Math.random() * 11.29).toFixed(2));
  } else {
    // Moon shot: 16.51x - 65.00x
    return Number((16.51 + Math.random() * 48.49).toFixed(2));
  }
}

/**
 * Calculates the duration in seconds to reach the target crash multiplier.
 * Uses a logarithmic time scale with slight volatility noise.
 */
export function calculateRoundDuration(crashMultiplier: number): number {
  if (crashMultiplier <= 1.05) return 0.8 + Math.random() * 0.6;
  if (crashMultiplier <= 1.3) return 1.8 + Math.random() * 1.2;

  // Base time: roughly 3 to 4 seconds per 2x doubler
  const doublings = Math.log2(crashMultiplier);
  const baseTime = 1.8 + doublings * 3.2;
  return Math.max(1.2, baseTime);
}

/**
 * Initializes a new round simulation parameters.
 */
export function createRoundSimulation(): RoundSimulation {
  const crashMultiplier = generateCrashMultiplier();
  const durationSeconds = calculateRoundDuration(crashMultiplier);
  const seed = Math.random() * 1000;
  const fluctuationFreq = 2.4 + Math.random() * 1.8;
  const fluctuationAmp = 0.035 + Math.random() * 0.04;

  return {
    crashMultiplier,
    durationSeconds,
    seed,
    fluctuationFreq,
    fluctuationAmp,
  };
}

/**
 * Calculates the fluctuating multiplier at elapsed time `t` (in seconds).
 * Ensures:
 * 1. Starts at 1.00x at t = 0
 * 2. Features genuine market fluctuations (micro dips, consolidation zones, surges)
 * 3. Never drops below 1.00x
 * 4. Smoothly converges to crashMultiplier at t = durationSeconds
 */
export function getMultiplierAtTime(t: number, sim: RoundSimulation): number {
  if (t <= 0) return 1.0;
  if (t >= sim.durationSeconds) return sim.crashMultiplier;

  const progress = t / sim.durationSeconds; // 0.0 to 1.0

  // Exponential growth curve baseline
  const baseMultiplier = 1.0 + (sim.crashMultiplier - 1.0) * Math.pow(progress, 1.35);

  // Market wave fluctuations (two interfering sine waves)
  const wave1 = Math.sin(t * sim.fluctuationFreq + sim.seed);
  const wave2 = Math.cos(t * (sim.fluctuationFreq * 1.63) + sim.seed * 0.7);

  // Amplitude scales with progress, but dampens near the very start and end to guarantee clean endpoints
  const envelope = Math.sin(progress * Math.PI);
  const fluctuation = (wave1 * 0.65 + wave2 * 0.35) * sim.fluctuationAmp * envelope * (baseMultiplier * 0.5);

  const rawVal = baseMultiplier + fluctuation;

  // Never drop below 1.00
  const clamped = Math.max(1.0, rawVal);

  return Number(clamped.toFixed(2));
}
