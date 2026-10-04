'use client';

import React, { useState, useEffect } from 'react';
import { BetSlotState, SlotId, RoundPhase } from '@/types/trader';

interface BettingSlotProps {
  slot: BetSlotState;
  balance: number;
  roundPhase: RoundPhase;
  currentMultiplier: number;
  onPlaceBet: (slotId: SlotId, amount: number) => void;
  onCashOut: (slotId: SlotId) => void;
  onAmountChange: (slotId: SlotId, amount: number) => void;
  onAutoCashoutChange: (slotId: SlotId, enabled: boolean, multiplier?: number) => void;
}

export const BettingSlot: React.FC<BettingSlotProps> = ({
  slot,
  balance,
  roundPhase,
  currentMultiplier,
  onPlaceBet,
  onCashOut,
  onAmountChange,
  onAutoCashoutChange,
}) => {
  const [activeTab, setActiveTab] = useState<'BET' | 'AUTO' | 'FREE'>('BET');
  const [inputVal, setInputVal] = useState<string>(slot.amount.toFixed(2));
  const [autoMultVal, setAutoMultVal] = useState<string>(
    slot.autoCashoutMultiplier.toFixed(2)
  );

  useEffect(() => {
    setInputVal(slot.amount.toFixed(2));
  }, [slot.amount]);

  const handleStep = (delta: number) => {
    if (slot.status !== 'EMPTY' || roundPhase !== 'BETTING') return;
    const next = Math.max(0.1, Math.min(500, Number((slot.amount + delta).toFixed(2))));
    onAmountChange(slot.id, next);
  };

  const handleHalf = () => {
    if (slot.status !== 'EMPTY' || roundPhase !== 'BETTING') return;
    const next = Math.max(0.1, Number((slot.amount / 2).toFixed(2)));
    onAmountChange(slot.id, next);
  };

  const handleDouble = () => {
    if (slot.status !== 'EMPTY' || roundPhase !== 'BETTING') return;
    const next = Math.min(500, Math.min(balance, Number((slot.amount * 2).toFixed(2))));
    onAmountChange(slot.id, next);
  };

  const handlePreset = (val: number) => {
    if (slot.status !== 'EMPTY' || roundPhase !== 'BETTING') return;
    onAmountChange(slot.id, Math.min(balance, val));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputVal(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      onAmountChange(slot.id, num);
    }
  };

  const handleAutoMultChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAutoMultVal(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 1.05) {
      onAutoCashoutChange(slot.id, slot.autoCashoutEnabled, num);
    }
  };

  const toggleAutoCashout = () => {
    const next = !slot.autoCashoutEnabled;
    onAutoCashoutChange(slot.id, next, parseFloat(autoMultVal) || 2.0);
  };

  const isLive = roundPhase === 'LIVE';
  const isBetting = roundPhase === 'BETTING';
  const isActive = slot.status === 'ACTIVE';
  const isPending = slot.status === 'BET_PENDING';
  const isCashed = slot.status === 'CASHED_OUT';
  const isLost = slot.status === 'LOST';

  const currentCashoutVal = (slot.amount * currentMultiplier).toFixed(2);
  const canPlaceBet =
    slot.status === 'EMPTY' && isBetting && balance >= slot.amount;

  return (
    <div className="flex-1 bg-[#0E1118] border border-[#1E2330] rounded-xl p-3 sm:p-3.5 flex flex-col justify-between space-y-2.5 select-none shadow-lg">
      {/* 1. Header: Slot Label + Sub-Tabs: Bet | Auto | Free Bet */}
      <div className="flex items-center justify-between border-b border-[#181D28] pb-2">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-[#181D2A] text-white border border-[#273042]">
            {slot.label}
          </span>
        </div>

        <div className="flex items-center space-x-1 bg-[#090B10] p-0.5 rounded-lg border border-[#1B202B]">
          <button
            type="button"
            onClick={() => setActiveTab('BET')}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
              activeTab === 'BET'
                ? 'bg-[#222938] text-white shadow-sm'
                : 'text-[#718096] hover:text-white'
            }`}
          >
            Bet
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AUTO')}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
              activeTab === 'AUTO'
                ? 'bg-[#222938] text-white shadow-sm'
                : 'text-[#718096] hover:text-white'
            }`}
          >
            Auto
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('FREE')}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
              activeTab === 'FREE'
                ? 'bg-[#222938] text-white shadow-sm'
                : 'text-[#718096] hover:text-white'
            }`}
          >
            Free Bet
          </button>
        </div>
      </div>

      {/* Auto Settings Drawer if Auto Tab is selected */}
      {activeTab === 'AUTO' && (
        <div className="flex items-center justify-between bg-[#080A0E] border border-[#1E2330] rounded-lg px-3 py-1.5 text-xs">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={slot.autoCashoutEnabled}
              onChange={toggleAutoCashout}
              className="rounded accent-[#00D26A] w-4 h-4 cursor-pointer"
            />
            <span className="text-[#A0AEC0] text-xs font-semibold">Auto Cashout</span>
          </label>

          <div className="flex items-center space-x-1.5">
            <span className="text-[#718096] font-semibold text-xs">At:</span>
            <input
              type="number"
              step="0.1"
              min="1.05"
              max="100"
              value={autoMultVal}
              onChange={handleAutoMultChange}
              disabled={!slot.autoCashoutEnabled}
              className="w-20 bg-[#141822] border border-[#273042] rounded-md px-2 py-1 text-center font-black text-white text-xs disabled:opacity-40 focus:border-[#E50914] focus:outline-none"
            />
            <span className="text-[#A0AEC0] font-black text-xs">x</span>
          </div>
        </div>
      )}

      {/* Free Bet Demo Drawer if Free Bet Tab is selected */}
      {activeTab === 'FREE' && (
        <div className="bg-[#080A0E] border border-[#1E2330] rounded-lg px-2.5 py-1.5 text-[11px] text-[#718096] text-center font-medium italic">
          Free Bets (Demo promotional credits only)
        </div>
      )}

      {/* 2. Controls & Dominant Action Button Grid */}
      <div className="grid grid-cols-12 gap-2.5 items-stretch">
        {/* Left: Input, Stepper & Presets ($1, $5, $10, $25, $50) */}
        <div className="col-span-7 flex flex-col justify-between space-y-2">
          {/* Stepper Input Row */}
          <div className="flex items-center bg-[#080A0F] border border-[#1E2330] rounded-lg p-1">
            <button
              type="button"
              disabled={slot.status !== 'EMPTY' || !isBetting}
              onClick={() => handleStep(-1)}
              className="w-8 h-8 rounded-md bg-[#161B26] hover:bg-[#202738] active:scale-95 text-white font-black text-base flex items-center justify-center transition border border-[#232B3E] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              &minus;
            </button>
            <div className="flex-1 flex items-center justify-center px-1">
              <span className="text-xs text-[#718096] font-bold mr-0.5">$</span>
              <input
                type="number"
                step="any"
                min={0.1}
                max={500}
                disabled={slot.status !== 'EMPTY' || !isBetting}
                value={inputVal}
                onChange={handleInputChange}
                className="w-full bg-transparent text-center font-black text-sm sm:text-base text-white focus:outline-none tabular-nums disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              disabled={slot.status !== 'EMPTY' || !isBetting}
              onClick={() => handleStep(1)}
              className="w-8 h-8 rounded-md bg-[#161B26] hover:bg-[#202738] active:scale-95 text-white font-black text-base flex items-center justify-center transition border border-[#232B3E] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>

          {/* Quick Buttons: /2, x2, and Presets ($1, $5, $10, $25, $50) */}
          <div className="flex items-center space-x-1 text-xs">
            <button
              type="button"
              disabled={slot.status !== 'EMPTY' || !isBetting}
              onClick={handleHalf}
              className="px-2 py-1.5 rounded-md bg-[#131722] hover:bg-[#1C2333] text-[#A0AEC0] font-bold border border-[#202738] transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Half amount"
            >
              /2
            </button>
            <button
              type="button"
              disabled={slot.status !== 'EMPTY' || !isBetting}
              onClick={handleDouble}
              className="px-2 py-1.5 rounded-md bg-[#131722] hover:bg-[#1C2333] text-[#A0AEC0] font-bold border border-[#202738] transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Double amount"
            >
              x2
            </button>
            {[1, 5, 10, 25, 50].map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={slot.status !== 'EMPTY' || !isBetting}
                onClick={() => handlePreset(preset)}
                className={`flex-1 py-1.5 rounded-md text-[11px] font-black transition border ${
                  slot.amount === preset
                    ? 'bg-[#E50914] text-white border-[#E50914] shadow-md shadow-[#E50914]/25'
                    : 'bg-[#11141D] text-[#8C98A9] border-[#1E2330] hover:text-white hover:border-[#2C3446]'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                ${preset}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Dominant Action Button */}
        <div className="col-span-5 flex flex-col justify-stretch">
          {/* Active during LIVE round -> CASH OUT! */}
          {isLive && isActive ? (
            <button
              type="button"
              onClick={() => onCashOut(slot.id)}
              className="w-full h-full min-h-[72px] py-2 rounded-xl font-black text-black bg-[#00D26A] hover:bg-[#00E575] shadow-lg shadow-[#00D26A]/30 transition active:scale-95 flex flex-col items-center justify-center cursor-pointer border border-[#48FF98]/40 animate-pulse"
            >
              <span className="text-[11px] uppercase tracking-wider font-extrabold text-black/80">
                CASH OUT
              </span>
              <span className="text-xs font-black text-black/90 tabular-nums">
                {currentMultiplier.toFixed(2)}x
              </span>
              <span className="text-base font-black tabular-nums text-black leading-tight">
                ${currentCashoutVal}
              </span>
            </button>
          ) : isActive && isBetting ? (
            /* Active during countdown -> WAITING FOR ROUND */
            <button
              type="button"
              disabled
              className="w-full h-full min-h-[72px] py-2 rounded-xl font-bold text-xs text-amber-300 bg-[#261B0B] border border-amber-500/50 cursor-not-allowed flex flex-col items-center justify-center animate-pulse"
            >
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-extrabold">
                BET PLACED
              </span>
              <span className="text-sm font-black tabular-nums text-white mt-0.5">
                ${slot.amount.toFixed(2)} USD
              </span>
              <span className="text-[9px] uppercase tracking-wider text-amber-300/80 mt-0.5">
                WAITING FOR FLIGHT
              </span>
            </button>
          ) : isCashed ? (
            /* Cashed out with payout */
            <button
              type="button"
              disabled
              className="w-full h-full min-h-[72px] py-2 rounded-xl font-bold text-xs text-[#00D26A] bg-[#0A1F17] border border-[#00D26A]/50 cursor-not-allowed flex flex-col items-center justify-center"
            >
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#00D26A]/80">
                CASHED OUT
              </span>
              <span className="text-xs font-black text-white tabular-nums">
                {slot.cashedMultiplier ? `${slot.cashedMultiplier.toFixed(2)}x` : ''}
              </span>
              <span className="text-base font-black tabular-nums text-[#00D26A] leading-tight">
                +${slot.payout?.toFixed(2)} USD
              </span>
            </button>
          ) : isLost ? (
            /* Lost on crash */
            <button
              type="button"
              disabled
              className="w-full h-full min-h-[72px] py-2 rounded-xl font-bold text-xs text-[#EF4444] bg-[#220B0F] border border-[#DC2626]/50 cursor-not-allowed flex flex-col items-center justify-center"
            >
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#EF4444]/80">
                LOST
              </span>
              <span className="text-sm font-black text-white uppercase tracking-wider mt-0.5">
                CRASHED
              </span>
            </button>
          ) : isPending ? (
            /* Bet pending host acceptance */
            <button
              type="button"
              disabled
              className="w-full h-full min-h-[72px] py-2 rounded-xl font-bold text-xs text-blue-300 bg-[#0B1526] border border-blue-500/50 cursor-not-allowed flex flex-col items-center justify-center animate-pulse"
            >
              <span className="text-[10px] uppercase tracking-wider font-extrabold">VERIFYING...</span>
            </button>
          ) : !isBetting && !isActive ? (
            /* Betting closed during LIVE round for this empty slot */
            <button
              type="button"
              disabled
              className="w-full h-full min-h-[72px] py-2 rounded-xl font-bold text-xs text-[#6B7280] bg-[#121620] border border-[#1E2330] cursor-not-allowed flex flex-col items-center justify-center"
            >
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#718096]">
                BETTING CLOSED
              </span>
              <span className="text-[10px] text-[#4B5563] mt-0.5 font-semibold">NEXT ROUND SOON</span>
            </button>
          ) : (
            /* Ready to place bet */
            <button
              type="button"
              disabled={!canPlaceBet}
              onClick={() => onPlaceBet(slot.id, slot.amount)}
              className={`w-full h-full min-h-[72px] py-2 rounded-xl font-black transition active:scale-95 flex flex-col items-center justify-center ${
                canPlaceBet
                  ? 'bg-[#00D26A] hover:bg-[#00E575] text-black shadow-lg shadow-[#00D26A]/25 cursor-pointer border border-[#34D399]/40'
                  : 'bg-[#181D28] text-[#556070] cursor-not-allowed border border-[#222938]'
              }`}
            >
              <span className="text-xs font-black tracking-wider uppercase">
                {slot.label}
              </span>
              <span className="text-sm sm:text-base font-black tabular-nums mt-0.5">
                ${slot.amount.toFixed(2)} USD
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
