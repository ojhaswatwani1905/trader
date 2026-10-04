'use client';

import React, { useState } from 'react';
import { SimulatedTrader, BetSlotState, RoundPhase } from '@/types/trader';

interface LiveBetsPanelProps {
  traders: SimulatedTrader[];
  currentMultiplier: number;
  slot1: BetSlotState;
  slot2: BetSlotState;
  roundPhase: RoundPhase;
}

export const LiveBetsPanel: React.FC<LiveBetsPanelProps> = ({
  traders,
  currentMultiplier,
  slot1,
  slot2,
  roundPhase,
}) => {
  const [activeTab, setActiveTab] = useState<'LIVE' | 'PREVIOUS' | 'TOP'>('LIVE');

  // Count active player bets (slot1 + slot2)
  const userActiveBetsCount =
    (slot1.status !== 'EMPTY' ? 1 : 0) + (slot2.status !== 'EMPTY' ? 1 : 0);

  const totalUserWin = (slot1.payout || 0) + (slot2.payout || 0);

  return (
    <div className="w-full bg-[#0C0F17] border border-[#1A1F2C] rounded-xl flex flex-col h-full select-none overflow-hidden text-xs shadow-lg">
      {/* 1. Header Tabs: Live bets | Previous | Top results */}
      <div className="flex items-center space-x-1 p-2 bg-[#090B10] border-b border-[#181D28]">
        <button
          type="button"
          onClick={() => setActiveTab('LIVE')}
          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
            activeTab === 'LIVE'
              ? 'bg-[#1C2333] text-white shadow-sm'
              : 'text-[#718096] hover:text-white'
          }`}
        >
          Live bets
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('PREVIOUS')}
          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
            activeTab === 'PREVIOUS'
              ? 'bg-[#1C2333] text-white shadow-sm'
              : 'text-[#718096] hover:text-white'
          }`}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('TOP')}
          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
            activeTab === 'TOP'
              ? 'bg-[#1C2333] text-white shadow-sm'
              : 'text-[#718096] hover:text-white'
          }`}
        >
          Top results
        </button>
      </div>

      {/* 2. User Summary Block */}
      <div className="flex items-center justify-between p-3 border-b border-[#181D28] bg-[#0E121C]">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#E50914] flex items-center justify-center text-white text-xs font-black shadow-md shadow-[#E50914]/20">
            👤
          </div>
          <div>
            <div className="text-[11px] font-black text-white">
              {userActiveBetsCount}/2 Bets
            </div>
            <div className="text-[10px] text-[#718096] font-semibold">My Positions</div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-black text-[#00D26A] tabular-nums">
            ${totalUserWin.toFixed(2)}
          </div>
          <div className="text-[9px] text-[#718096] uppercase font-bold tracking-wider">Total Win, USD</div>
        </div>
      </div>

      {/* 3. Table Header: PLAYER | BET | MULTIPLIER | STATUS */}
      <div className="grid grid-cols-12 px-3 py-1.5 bg-[#090B10] text-[10px] font-black uppercase tracking-wider text-[#718096] border-b border-[#181D28]">
        <div className="col-span-4">Player</div>
        <div className="col-span-3 text-right">Bet</div>
        <div className="col-span-2 text-center">X</div>
        <div className="col-span-3 text-right">Status</div>
      </div>

      {/* 4. Scrollable Players List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#141824] max-h-[380px] lg:max-h-[440px]">
        {/* User's Slot 1 position if active */}
        {slot1.status !== 'EMPTY' && (
          <div className="grid grid-cols-12 px-3 py-2 items-center bg-[#0D2418]/50 text-white font-medium">
            <div className="col-span-4 flex items-center space-x-1.5 truncate">
              <span className="w-4 h-4 rounded bg-[#00D26A] text-[9px] flex items-center justify-center font-black text-black">
                1
              </span>
              <span className="truncate text-[#00D26A] font-black">You (Bet 1)</span>
            </div>
            <div className="col-span-3 text-right text-slate-200 font-bold tabular-nums">
              ${slot1.amount.toFixed(2)}
            </div>
            <div className="col-span-2 text-center font-black text-white tabular-nums">
              {slot1.cashedMultiplier ? `${slot1.cashedMultiplier.toFixed(2)}x` : '-'}
            </div>
            <div className="col-span-3 text-right">
              {slot1.status === 'CASHED_OUT' ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#00D26A]/20 text-[#00D26A] border border-[#00D26A]/35">
                  +${slot1.payout?.toFixed(2)}
                </span>
              ) : slot1.status === 'LOST' ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/35">
                  LOST
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#141824] text-[#A0AEC0] border border-[#232B3E]">
                  TRADING
                </span>
              )}
            </div>
          </div>
        )}

        {/* User's Slot 2 position if active */}
        {slot2.status !== 'EMPTY' && (
          <div className="grid grid-cols-12 px-3 py-2 items-center bg-[#0D2418]/50 text-white font-medium">
            <div className="col-span-4 flex items-center space-x-1.5 truncate">
              <span className="w-4 h-4 rounded bg-[#00D26A] text-[9px] flex items-center justify-center font-black text-black">
                2
              </span>
              <span className="truncate text-[#00D26A] font-black">You (Bet 2)</span>
            </div>
            <div className="col-span-3 text-right text-slate-200 font-bold tabular-nums">
              ${slot2.amount.toFixed(2)}
            </div>
            <div className="col-span-2 text-center font-black text-white tabular-nums">
              {slot2.cashedMultiplier ? `${slot2.cashedMultiplier.toFixed(2)}x` : '-'}
            </div>
            <div className="col-span-3 text-right">
              {slot2.status === 'CASHED_OUT' ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#00D26A]/20 text-[#00D26A] border border-[#00D26A]/35">
                  +${slot2.payout?.toFixed(2)}
                </span>
              ) : slot2.status === 'LOST' ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/35">
                  LOST
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#141824] text-[#A0AEC0] border border-[#232B3E]">
                  TRADING
                </span>
              )}
            </div>
          </div>
        )}

        {/* Simulated Traders */}
        {traders.map((trader) => (
          <div
            key={trader.id}
            className={`grid grid-cols-12 px-3 py-2 items-center transition-colors ${
              trader.status === 'CASHED' ? 'bg-[#0D2418]/25' : 'hover:bg-[#121622]'
            }`}
          >
            <div className="col-span-4 flex items-center space-x-1.5 truncate text-[#A0AEC0]">
              <span className="w-4 h-4 rounded-full bg-[#1C2333] text-[9px] flex items-center justify-center text-[#718096]">
                ●
              </span>
              <span className="truncate font-semibold">{trader.name}</span>
            </div>
            <div className="col-span-3 text-right text-[#CBD5E1] font-semibold tabular-nums">
              ${trader.bet.toFixed(2)}
            </div>
            <div className="col-span-2 text-center font-black text-white tabular-nums">
              {trader.status === 'CASHED' && trader.cashedMultiplier
                ? `${trader.cashedMultiplier.toFixed(2)}x`
                : '-'}
            </div>
            <div className="col-span-3 text-right">
              {trader.status === 'CASHED' ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#00D26A]/20 text-[#00D26A] border border-[#00D26A]/30">
                  CASHED
                </span>
              ) : trader.status === 'LOST' ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30">
                  LOST
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#141824] text-[#718096] border border-[#232B3E]">
                  TRADING
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 5. Footer Disclaimer */}
      <div className="p-2 bg-[#090B10] border-t border-[#181D28] text-[10px] text-[#718096] text-center font-bold uppercase tracking-wider">
        DEMO SIMULATION PARTICIPANTS &bull; NO REAL MONEY
      </div>
    </div>
  );
};

