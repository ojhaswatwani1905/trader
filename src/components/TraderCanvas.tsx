'use client';

import React, { useRef, useEffect } from 'react';
import { RoundPhase, TrajectoryPoint } from '@/types/trader';

interface TraderCanvasProps {
  currentMultiplier: number;
  roundPhase: RoundPhase;
  finalMultiplier: number | null;
  countdown: number;
  trajectory?: TrajectoryPoint[];
}

const TOTAL_COLUMNS = 16;
const SECONDS_PER_COLUMN = 0.38; // Time window per market column

export const TraderCanvas: React.FC<TraderCanvasProps> = ({
  currentMultiplier,
  roundPhase,
  finalMultiplier,
  countdown,
  trajectory = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Animated bar heights for up to 16 visible columns
  const animatedHeightsRef = useRef<number[]>(new Array(TOTAL_COLUMNS).fill(0));
  // Keep previous values for clean transitions
  const prevPhaseRef = useRef<RoundPhase>(roundPhase);

  // Main canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animId: number;

    const render = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = rect.height;

      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Dark professional background
      ctx.fillStyle = '#080A0F';
      ctx.fillRect(0, 0, width, height);

      // Coordinates setup
      const bottomAxisY = height - 12;
      const chartBottom = height - 32;
      const topTrackY = 28;
      const colWidth = width / TOTAL_COLUMNS;
      const availableHeight = chartBottom - topTrackY - 20;

      // 2. Subtle dark grid lines
      ctx.strokeStyle = '#141822';
      ctx.lineWidth = 1;

      // Vertical grid lines aligned with column dividers
      for (let i = 0; i <= TOTAL_COLUMNS; i++) {
        const x = Math.round(i * colWidth);
        ctx.beginPath();
        ctx.moveTo(x, topTrackY - 10);
        ctx.lineTo(x, chartBottom);
        ctx.stroke();
      }

      // Horizontal grid lines
      const horizontalDivs = 4;
      for (let j = 0; j <= horizontalDivs; j++) {
        const y = Math.round(topTrackY + (j / horizontalDivs) * (chartBottom - topTrackY));
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Render in LIVE or CRASHED state: Discretized Authoritative Market Columns
      if (roundPhase === 'LIVE' || roundPhase === 'CRASHED') {
        const isCrashed = roundPhase === 'CRASHED';
        const displayVal = finalMultiplier !== null ? finalMultiplier : currentMultiplier;

        // Determine current elapsed time from trajectory
        let currentT = 0;
        if (trajectory.length > 0) {
          currentT = trajectory[trajectory.length - 1].t;
        }

        // Calculate total market columns generated so far
        const totalSteps = Math.max(1, Math.floor(currentT / SECONDS_PER_COLUMN) + 1);

        // Determine visible columns window (16 columns max, scrolls when totalSteps > 16)
        let startStep = 0;
        let endStep = totalSteps - 1;
        if (totalSteps > TOTAL_COLUMNS) {
          startStep = totalSteps - TOTAL_COLUMNS;
          endStep = totalSteps - 1;
        }

        const visibleColCount = Math.min(TOTAL_COLUMNS, totalSteps);

        // Extract multiplier for each visible column from authoritative trajectory
        const visibleMultipliers: number[] = [];
        for (let s = startStep; s <= endStep; s++) {
          if (s === endStep) {
            // Latest column always gets the authoritative live multiplier
            visibleMultipliers.push(displayVal);
          } else {
            // Find closest trajectory point at column time
            const targetT = (s + 0.5) * SECONDS_PER_COLUMN;
            let val = 1.0;
            if (trajectory.length > 0) {
              let closest = trajectory[0];
              let minDiff = Math.abs(trajectory[0].t - targetT);
              for (let pt of trajectory) {
                const diff = Math.abs(pt.t - targetT);
                if (diff < minDiff) {
                  minDiff = diff;
                  closest = pt;
                }
              }
              val = closest.multiplier;
            }
            visibleMultipliers.push(val);
          }
        }

        // Find maximum multiplier observed for vertical scaling
        let maxObserved = 2.0;
        for (let m of visibleMultipliers) {
          if (m > maxObserved) maxObserved = m;
        }
        if (displayVal > maxObserved) maxObserved = displayVal;
        const scaleMax = maxObserved * 1.15; // 15% head room

        // Bottom X-axis labels (e.g. 1..16 or 4..20)
        ctx.fillStyle = '#4B5563';
        ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';

        const barTopPoints: Array<{ x: number; y: number }> = [];
        const barWidth = Math.max(10, Math.min(26, colWidth * 0.48));

        // Draw each column
        for (let i = 0; i < TOTAL_COLUMNS; i++) {
          const colIndex = startStep + i + 1;
          const cx = Math.round((i + 0.5) * colWidth);

          // X-axis column number
          ctx.fillText(String(colIndex), cx, bottomAxisY);

          // If this column is active in the current round
          if (i < visibleMultipliers.length) {
            const multVal = visibleMultipliers[i];
            const isLatest = i === visibleMultipliers.length - 1;

            // Height calculation normalized to scaleMax
            const norm = Math.max(0.08, Math.min(0.96, multVal / scaleMax));
            const targetH = availableHeight * norm;

            // Smooth interpolation
            animatedHeightsRef.current[i] += (targetH - animatedHeightsRef.current[i]) * 0.25;
            const currentH = Math.max(4, animatedHeightsRef.current[i]);

            const bx = Math.round(cx - barWidth / 2);
            const by = Math.round(chartBottom - currentH);

            barTopPoints.push({ x: cx, y: by });

            // Draw rounded pill bar (BETADRiX crimson gradient)
            ctx.save();
            const grad = ctx.createLinearGradient(0, by, 0, chartBottom);
            if (isCrashed) {
              grad.addColorStop(0, '#E50914');
              grad.addColorStop(1, '#3A060A');
              ctx.shadowColor = 'rgba(229, 9, 20, 0.4)';
              ctx.shadowBlur = 6;
            } else {
              grad.addColorStop(0, isLatest ? '#EF4444' : '#DC2626');
              grad.addColorStop(1, '#450A0A');
              ctx.shadowColor = isLatest ? 'rgba(239, 68, 68, 0.5)' : 'rgba(220, 38, 38, 0.2)';
              ctx.shadowBlur = isLatest ? 8 : 4;
            }

            ctx.fillStyle = grad;

            // Rounded capsule bar
            ctx.beginPath();
            const r = barWidth / 2;
            ctx.moveTo(bx + r, by);
            ctx.lineTo(bx + barWidth - r, by);
            ctx.quadraticCurveTo(bx + barWidth, by, bx + barWidth, by + r);
            ctx.lineTo(bx + barWidth, chartBottom);
            ctx.lineTo(bx, chartBottom);
            ctx.lineTo(bx, by + r);
            ctx.quadraticCurveTo(bx, by, bx + r, by);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Top track value for this bar
            ctx.save();
            ctx.font = isLatest
              ? '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              : '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = isLatest ? (isCrashed ? '#EF4444' : '#FFFFFF') : '#6B7280';
            ctx.textAlign = 'center';
            ctx.fillText(`${multVal.toFixed(2)}x`, cx, topTrackY - 4);
            ctx.restore();
          }
        }

        // Draw smooth trajectory curve connecting the bar tops
        if (barTopPoints.length > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(barTopPoints[0].x, barTopPoints[0].y);

          for (let k = 1; k < barTopPoints.length; k++) {
            const prev = barTopPoints[k - 1];
            const curr = barTopPoints[k];
            const mx = (prev.x + curr.x) / 2;
            const my = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
          }
          const lastPoint = barTopPoints[barTopPoints.length - 1];
          ctx.lineTo(lastPoint.x, lastPoint.y);

          ctx.strokeStyle = isCrashed ? '#DC2626' : '#F87171';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = isCrashed ? 'rgba(220, 38, 38, 0.7)' : 'rgba(248, 113, 113, 0.6)';
          ctx.shadowBlur = 8;
          ctx.stroke();

          // Leading indicator dot at current head
          ctx.beginPath();
          ctx.arc(lastPoint.x, lastPoint.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = isCrashed ? '#DC2626' : '#EF4444';
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.restore();
        }
      } else {
        // BETTING state: default bottom axis labels 1..16
        ctx.fillStyle = '#374151';
        ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        for (let i = 1; i <= TOTAL_COLUMNS; i++) {
          const cx = Math.round((i - 0.5) * colWidth);
          ctx.fillText(String(i), cx, bottomAxisY);
        }
        // Reset animated heights
        for (let i = 0; i < TOTAL_COLUMNS; i++) {
          animatedHeightsRef.current[i] = 0;
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [roundPhase, currentMultiplier, finalMultiplier, trajectory]);

  const isLive = roundPhase === 'LIVE';
  const isCrashed = roundPhase === 'CRASHED';
  const isBetting = roundPhase === 'BETTING';

  const displayMult = (
    finalMultiplier !== null ? finalMultiplier : currentMultiplier
  ).toFixed(2);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[320px] sm:h-[380px] lg:h-[400px] bg-[#080A0F] border rounded-lg overflow-hidden select-none flex flex-col justify-between transition-colors duration-300 ${
        isCrashed ? 'border-[#DC2626]/50 shadow-[inset_0_0_20px_rgba(220,38,38,0.15)]' : 'border-[#1E2330]'
      }`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Center Overlay: Countdown ring or Big Multiplier Readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
        {isBetting ? (
          /* Waiting / Countdown Phase matching BETADRiX & Spribe style */
          <div className="flex flex-col items-center justify-center animate-fade-in">
            <div className="relative w-24 h-24 flex items-center justify-center">
              {/* Circular countdown progress ring */}
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#1A202C"
                  strokeWidth="5"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#E50914"
                  strokeWidth="5"
                  fill="none"
                  strokeDasharray="251"
                  strokeDashoffset={((5 - countdown) / 5) * 251}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <span className="absolute font-black text-4xl text-white tabular-nums">
                {countdown}
              </span>
            </div>
            <div className="mt-3 font-black text-base tracking-widest text-white uppercase drop-shadow-sm">
              MAKE YOUR BETS!
            </div>
            <div className="mt-1 text-[10px] tracking-wider text-[#718096] uppercase font-semibold">
              BETADRiX OFFICIAL GAME
            </div>
          </div>
        ) : isLive || isCrashed ? (
          /* Live or Crashed Phase */
          <div className="flex flex-col items-center justify-center text-center">
            <span
              className={`text-xs uppercase tracking-widest font-black transition-colors ${
                isCrashed ? 'text-[#EF4444]' : 'text-[#94A3B8]'
              }`}
            >
              {isCrashed ? 'CRASHED' : 'Current X'}
            </span>

            <div
              className={`text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight tabular-nums mt-0.5 transition-colors ${
                isCrashed
                  ? 'text-[#DC2626] drop-shadow-[0_0_24px_rgba(220,38,38,0.6)]'
                  : 'text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.25)]'
              }`}
            >
              {displayMult}x
            </div>

            {/* Indicator Dots under Current Multiplier */}
            {!isCrashed ? (
              <div className="flex items-center space-x-1.5 mt-2">
                <span className="w-2 h-2 rounded-full bg-[#E50914] animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] opacity-75" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] opacity-50" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] opacity-30" />
                <span className="w-1 h-1 rounded-full bg-[#E50914] opacity-20" />
              </div>
            ) : (
              <div className="mt-2 text-xs font-bold text-[#EF4444] tracking-wider uppercase">
                ROUND ENDED
              </div>
            )}
          </div>
        ) : (
          <div className="text-center opacity-60">
            <div className="text-5xl font-black text-slate-500 tabular-nums">1.00x</div>
            <div className="text-xs uppercase tracking-wider text-[#718096] mt-1 font-bold">
              WAITING FOR NEXT ROUND
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

