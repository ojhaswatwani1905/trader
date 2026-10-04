'use client';

import React from 'react';
import { RoundPhase } from '@/types/trader';

interface TraderHeaderProps {
  isEmbedded: boolean;
  roundPhase: RoundPhase;
  balance: number;
  currency: string;
  soundMuted: boolean;
  onToggleSound: () => void;
  onResetBalance: () => void;
}

export const TraderHeader: React.FC<TraderHeaderProps> = ({
  isEmbedded,
  roundPhase,
  balance,
  currency,
  soundMuted,
  onToggleSound,
  onResetBalance,
}) => {
  const isConnecting = isEmbedded && roundPhase === 'BETTING' && balance === 0;

  return (
    <header className="w-full flex items-center justify-between bg-[#0C0F17] border-b border-[#1A1F2C] px-3.5 sm:px-4 py-2.5 select-none">
      {/* Left side: Trader, Subtitle & Status Pill */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-[#E50914] flex items-center justify-center font-black text-white text-sm shadow-md shadow-[#E50914]/20">
            T
          </div>
          <span className="text-base font-black text-white tracking-wide">
            Trader
          </span>
        </div>

        <span className="text-[#2D3748] hidden sm:inline">&bull;</span>

        <span className="text-[11px] font-bold text-[#718096] hidden sm:inline uppercase tracking-wider">
          CRASH GAME &bull; SIMULATION DEMO
        </span>

        {/* Status Pill */}
        <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#141824] border border-[#232B3E] text-[#A0AEC0]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnecting
                ? 'bg-amber-400 animate-ping'
                : 'bg-[#00D26A] shadow-[0_0_8px_#00D26A]'
            }`}
          />
          <span>
            {isConnecting
              ? 'CONNECTING...'
              : isEmbedded
              ? 'BETADRiX DEMO'
              : 'STANDALONE DEMO'}
          </span>
        </div>
      </div>

      {/* Right side: Demo Balance, Reset (standalone only), Sound Toggle */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        <div className="flex flex-col text-right">
          <span className="text-[9px] uppercase tracking-wider text-[#718096] font-bold">
            {isEmbedded ? 'BETADRiX WALLET' : 'DEMO BALANCE'}
          </span>
          <span className="text-sm sm:text-base font-black text-white tabular-nums">
            {isConnecting ? (
              <span className="text-[#718096] text-xs">CONNECTING...</span>
            ) : (
              `$${balance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} USD`
            )}
          </span>
        </div>

        {/* Reset button only in standalone mode */}
        {!isEmbedded && (
          <button
            type="button"
            onClick={onResetBalance}
            title="Reset Demo Balance to $1,250.00"
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#161B26] hover:bg-[#202738] active:scale-95 text-[#CBD5E1] border border-[#232B3E] transition shadow-sm"
          >
            RESET
          </button>
        )}

        {/* Sound Toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          title={soundMuted ? 'Unmute Sound' : 'Mute Sound'}
          className={`p-1.5 rounded-lg border transition active:scale-95 flex items-center justify-center shadow-sm ${
            soundMuted
              ? 'bg-[#141824] text-[#718096] border-[#232B3E] hover:text-white'
              : 'bg-[#161B26] text-[#00D26A] border-[#232B3E] hover:bg-[#202738]'
          }`}
        >
          {soundMuted ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
};
