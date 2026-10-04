'use client';

import React from 'react';
import { HistoryItem } from '@/types/trader';

interface HistoryBarProps {
  history: HistoryItem[];
}

export const HistoryBar: React.FC<HistoryBarProps> = ({ history }) => {
  return (
    <div className="w-full flex items-center space-x-2 overflow-x-auto py-1.5 px-3 bg-[#0B1020] border border-[#1E293B] rounded-lg select-none scrollbar-none">
      <span className="text-[11px] font-bold text-[#7C8799] uppercase tracking-wider whitespace-nowrap pr-3 border-r border-[#1E293B]">
        RECENT ROUNDS
      </span>

      <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
        {history.length === 0 ? (
          <span className="text-xs text-[#7C8799] italic">No completed rounds yet</span>
        ) : (
          history.slice(0, 16).map((item) => {
            const mult = item.multiplier;
            const isHigh = mult >= 2.0;

            return (
              <span
                key={item.id}
                className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap transition-colors ${
                  isHigh
                    ? 'bg-[#0E261F] text-[#10B981] border border-[#10B981]/40'
                    : 'bg-[#0D1424] text-[#94A3B8] border border-[#1E293B]'
                }`}
                title={`Round at ${mult.toFixed(2)}x`}
              >
                {mult.toFixed(2)}x
              </span>
            );
          })
        )}
      </div>
    </div>
  );
};
