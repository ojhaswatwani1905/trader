'use client';

import React from 'react';
import { useTraderGame } from '@/hooks/useTraderGame';
import { TraderHeader } from './TraderHeader';
import { HistoryStrip } from './HistoryStrip';
import { TraderCanvas } from './TraderCanvas';
import { LiveBetsPanel } from './LiveBetsPanel';
import { BettingSlot } from './BettingSlot';

interface TraderGameProps {
  forceEmbedded?: boolean;
}

export const TraderGame: React.FC<TraderGameProps> = ({ forceEmbedded }) => {
  const {
    isEmbedded,
    isInitialized,
    roundId,
    roundPhase,
    countdown,
    currentMultiplier,
    finalMultiplier,
    balance,
    currency,
    history,
    simulatedTraders,
    soundMuted,
    slot1,
    slot2,
    trajectory,
    placeBet,
    cashOut,
    setSlotAmount,
    setAutoCashout,
    resetStandaloneBalance,
    toggleSound,
  } = useTraderGame({ forceEmbedded });

  // Client keepalive: touches /api/health to keep Render free instance active
  React.useEffect(() => {
    const pingHealth = () => {
      fetch('/api/health').catch(() => {});
    };
    pingHealth();
    const keeperInterval = setInterval(pingHealth, 4 * 60 * 1000); // ping every 4 mins
    return () => clearInterval(keeperInterval);
  }, []);

  return (
    <div
      className={`w-full flex flex-col bg-[#090C13] select-none text-white font-sans overflow-hidden ${
        isEmbedded
          ? 'h-full border-none rounded-none p-0'
          : 'max-w-[1300px] mx-auto border border-[#1A1F2C] rounded-2xl shadow-2xl'
      }`}
    >
      {/* 1. Game Header */}
      <TraderHeader
        isEmbedded={isEmbedded}
        isInitialized={isInitialized}
        roundPhase={roundPhase}
        balance={balance}
        currency={currency}
        soundMuted={soundMuted}
        onToggleSound={toggleSound}
        onResetBalance={resetStandaloneBalance}
      />

      {/* 2. Recent Multipliers Strip */}
      <HistoryStrip history={history} />

      {/* 3. Main Game Composition */}
      <div className="w-full flex flex-col lg:flex-row p-2.5 sm:p-3 gap-2.5 items-stretch bg-[#07090F]">
        {/* Left Column (~30%): Live Bets Panel */}
        <div className="w-full lg:w-[310px] xl:w-[330px] shrink-0 flex flex-col order-2 lg:order-1">
          <LiveBetsPanel
            traders={simulatedTraders}
            currentMultiplier={currentMultiplier}
            slot1={slot1}
            slot2={slot2}
            roundPhase={roundPhase}
          />
        </div>

        {/* Right / Center Column (~70%): Graph on top + TWO Betting Slots directly underneath */}
        <div className="flex-1 flex flex-col space-y-2.5 min-w-0 order-1 lg:order-2">
          {/* Central Trader Graph */}
          <TraderCanvas
            currentMultiplier={currentMultiplier}
            roundPhase={roundPhase}
            finalMultiplier={finalMultiplier}
            countdown={countdown}
            trajectory={trajectory}
          />

          {/* TWO Independent Betting Slots Side by Side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
            <BettingSlot
              slot={slot1}
              balance={balance}
              roundPhase={roundPhase}
              currentMultiplier={currentMultiplier}
              isEmbedded={isEmbedded}
              isInitialized={isInitialized}
              onPlaceBet={placeBet}
              onCashOut={cashOut}
              onAmountChange={setSlotAmount}
              onAutoCashoutChange={setAutoCashout}
            />

            <BettingSlot
              slot={slot2}
              balance={balance}
              roundPhase={roundPhase}
              currentMultiplier={currentMultiplier}
              isEmbedded={isEmbedded}
              isInitialized={isInitialized}
              onPlaceBet={placeBet}
              onCashOut={cashOut}
              onAmountChange={setSlotAmount}
              onAutoCashoutChange={setAutoCashout}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
