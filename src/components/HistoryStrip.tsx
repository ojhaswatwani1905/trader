'use client';

import React from 'react';
import { HistoryItem } from '@/types/trader';

interface HistoryStripProps {
  history: HistoryItem[];
}

export const HistoryStrip: React.FC<HistoryStripProps> = ({ history }) => {
  const getMultiplierStyle = (mult: number) => {
    if (mult >= 10.0) return 'text-[#EF4444] bg-[#2E0F14] border-[#EF4444]/40 font-black'; // Crimson 10x+
    if (mult >= 2.0) return 'text-[#C084FC] bg-[#241335] border-[#C084FC]/30 font-bold';    // Purple 2x-10x
    if (mult >= 1.0) return 'text-[#38BDF8] bg-[#0E1D2D] border-[#38BDF8]/30 font-semibold'; // Sky Blue 1x-2x
    return 'text-[#94A3B8] bg-[#121620] border-[#1E2330] font-medium';                       // Muted Slate < 1x
  };

  return (
    <div className="w-full flex items-center justify-between bg-[#0A0D14] border-b border-[#1A1F2C] px-3 py-1.5 select-none overflow-hidden text-xs">
      <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-0.5">
        <span className="text-[10px] uppercase font-black tracking-wider text-[#718096] shrink-0 pr-1">
          RECENT:
        </span>
        {history.length === 0 ? (
          <span className="text-xs text-[#4A5568] italic">Waiting for completed rounds...</span>
        ) : (
          history.slice(0, 24).map((item) => {
            const mult = item.multiplier;
            return (
              <span
                key={item.id}
                className={`text-[11px] px-2.5 py-0.5 rounded-full border whitespace-nowrap transition-transform hover:scale-105 cursor-default tabular-nums ${getMultiplierStyle(
                  mult
                )}`}
                title={`Round ${item.roundId} finished at ${mult.toFixed(2)}x`}
              >
                {mult.toFixed(2)}x
              </span>
            );
          })
        )}
      </div>

      {/* History clock icon with dropdown */}
      <div className="pl-2 shrink-0 flex items-center space-x-1 text-[#718096] hover:text-white cursor-pointer transition">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
};
