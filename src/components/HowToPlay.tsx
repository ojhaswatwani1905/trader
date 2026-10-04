'use client';

import React from 'react';

export const HowToPlay: React.FC = () => {
  return (
    <div className="w-full bg-[#0B1020] border border-[#1E293B] rounded-lg p-3.5 flex flex-col space-y-2.5 text-xs text-[#7C8799] select-none">
      <div className="flex items-center space-x-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#E50914]" />
        <span className="font-bold text-white uppercase tracking-wider text-[11px]">
          HOW TO PLAY
        </span>
      </div>

      <ul className="space-y-1 text-[11px] leading-relaxed text-[#94A3B8]">
        <li className="flex items-start space-x-1.5">
          <span className="text-slate-500">&bull;</span>
          <span>Place your simulated bet before the round opens.</span>
        </li>
        <li className="flex items-start space-x-1.5">
          <span className="text-slate-500">&bull;</span>
          <span>Watch the live fluctuating market multiplier rise.</span>
        </li>
        <li className="flex items-start space-x-1.5">
          <span className="text-slate-500">&bull;</span>
          <span>Press <strong className="text-white font-semibold">CASH OUT</strong> before the crash occurs.</span>
        </li>
        <li className="flex items-start space-x-1.5">
          <span className="text-slate-500">&bull;</span>
          <span>If the market crashes before cashout, the wager is lost.</span>
        </li>
      </ul>

      <div className="pt-2 border-t border-[#1E293B] text-[10px] text-[#64748B] text-center font-medium tracking-wide uppercase">
        DEMO SIMULATION ONLY &bull; VIRTUAL CREDITS &bull; NO REAL MONEY
      </div>
    </div>
  );
};
