'use client';

import React from 'react';
import { SimulatedTrader } from '@/types/trader';

interface SimulatedFeedProps {
  traders: SimulatedTrader[];
  currentMultiplier: number;
}

export const SimulatedFeed: React.FC<SimulatedFeedProps> = ({
  traders,
  currentMultiplier,
}) => {
  if (traders.length === 0) return null;

  return (
    <div className="w-full bg-[#0B1020] border border-[#1E293B] rounded-lg p-3 select-none">
      <div className="flex items-center justify-between pb-2 border-b border-[#1E293B] text-[11px] font-bold">
        <span className="text-white tracking-wider uppercase">
          SIMULATED MARKET PARTICIPANTS
        </span>
        <span className="text-[9px] uppercase tracking-wider text-[#7C8799] bg-[#0D1424] px-2 py-0.5 rounded border border-[#1E293B]">
          VIRTUAL DEMO
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2.5">
        {traders.map((trader) => (
          <div
            key={trader.id}
            className={`p-2 rounded-md border text-xs flex flex-col justify-between transition-colors ${
              trader.status === 'CASHED'
                ? 'bg-[#0E261F] border-[#10B981]/30'
                : 'bg-[#070A14] border-[#1E293B]'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-bold text-slate-200 truncate text-[11px]">
                {trader.name}
              </span>
              <span className="text-[10px] text-[#7C8799] font-medium">
                ${trader.bet}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px] font-bold">
              <span
                className={trader.status === 'CASHED' ? 'text-[#10B981]' : 'text-slate-400'}
              >
                {trader.status === 'CASHED' ? 'CASHED' : 'TRADING'}
              </span>
              <span
                className={trader.status === 'CASHED' ? 'text-[#10B981]' : 'text-[#7C8799]'}
              >
                {trader.status === 'CASHED' && trader.cashedMultiplier
                  ? `${trader.cashedMultiplier.toFixed(2)}x`
                  : '...'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
