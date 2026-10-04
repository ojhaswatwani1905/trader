'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  RoundPhase,
  SlotId,
  BetSlotState,
  HistoryItem,
  SimulatedTrader,
  TrajectoryPoint,
  BetadrixInboundMessage,
  TraderOutboundMessage,
} from '@/types/trader';
import { isAllowedOrigin, getSafeTargetOrigin } from '@/lib/security';
import { soundManager } from '@/lib/sound';
import { TraderRoundEngine } from '@/lib/traderEngine';

const STANDALONE_INITIAL_BALANCE = 1250.0;
const STORAGE_STANDALONE_BALANCE = 'trader_standalone_balance';
const STORAGE_STANDALONE_HISTORY = 'trader_standalone_history';
const BETTING_COUNTDOWN_SECONDS = 5;

const MOCK_NAMES = [
  'Alex_M', 'Ryan_K', 'Sam_T', 'Elena_R', 'Marcus_B',
  'David_L', 'Chloe_S', 'Leo_V', 'Sophia_P', 'Lucas_D'
];

export interface UseTraderGameOptions {
  forceEmbedded?: boolean;
}

export function useTraderGame(options?: UseTraderGameOptions) {
  // Mode detection
  const [isEmbedded, setIsEmbedded] = useState<boolean>(false);
  const [detectedHostOrigin, setDetectedHostOrigin] = useState<string | null>(null);

  // Authoritative Round State
  const [roundId, setRoundId] = useState<string>('round_init');
  const [roundPhase, setRoundPhase] = useState<RoundPhase>('BETTING');
  const [countdown, setCountdown] = useState<number>(BETTING_COUNTDOWN_SECONDS);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.0);
  const [finalMultiplier, setFinalMultiplier] = useState<number | null>(null);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>([{ t: 0, multiplier: 1.0 }]);

  // Authoritative Wallet & Balance
  const [balance, setBalance] = useState<number>(
    options?.forceEmbedded ? 0 : STANDALONE_INITIAL_BALANCE
  );
  const [currency, setCurrency] = useState<string>('USD');
  const [isInitialized, setIsInitialized] = useState<boolean>(!options?.forceEmbedded);

  // History & Simulated Live Bets
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [simulatedTraders, setSimulatedTraders] = useState<SimulatedTrader[]>([]);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);

  // Two Independent Betting Slots
  const [slot1, setSlot1] = useState<BetSlotState>({
    id: 'slot1',
    label: 'BET 1',
    amount: 1.0,
    status: 'EMPTY',
    requestId: null,
    transactionId: null,
    roundId: null,
    autoCashoutEnabled: false,
    autoCashoutMultiplier: 2.0,
  });

  const [slot2, setSlot2] = useState<BetSlotState>({
    id: 'slot2',
    label: 'BET 2',
    amount: 1.0,
    status: 'EMPTY',
    requestId: null,
    transactionId: null,
    roundId: null,
    autoCashoutEnabled: false,
    autoCashoutMultiplier: 2.0,
  });

  // Synchronous State References (Guarantees zero race conditions)
  const roundIdRef = useRef<string>('round_init');
  const phaseRef = useRef<RoundPhase>('BETTING');
  const currentMultiplierRef = useRef<number>(1.0);
  const balanceRef = useRef<number>(options?.forceEmbedded ? 0 : STANDALONE_INITIAL_BALANCE);
  const isEmbeddedRef = useRef<boolean>(!!options?.forceEmbedded);
  const isInitializedRef = useRef<boolean>(!options?.forceEmbedded);
  const detectedOriginRef = useRef<string | null>(null);
  const engineRef = useRef<TraderRoundEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const roundStartTimeRef = useRef<number>(0);

  const slot1Ref = useRef<BetSlotState>(slot1);
  const slot2Ref = useRef<BetSlotState>(slot2);
  const cashOutRef = useRef<(slotId: SlotId) => void>(() => {});

  // Synchronize slot refs
  useEffect(() => {
    slot1Ref.current = slot1;
  }, [slot1]);

  useEffect(() => {
    slot2Ref.current = slot2;
  }, [slot2]);

  // Transaction Ledger & Idempotency Registries
  const pendingRequestsRef = useRef<Set<string>>(new Set());
  const activeWagersRef = useRef<Map<string, { roundId: string; slotId: SlotId; amount: number }>>(new Map());
  const settledRequestsRef = useRef<Set<string>>(new Set());

  // PostMessage Dispatcher
  const postToHost = useCallback((msg: TraderOutboundMessage) => {
    if (typeof window === 'undefined' || !window.parent || window.parent === window) {
      return;
    }
    const targetOrigin = getSafeTargetOrigin(detectedOriginRef.current);
    try {
      window.parent.postMessage(msg, targetOrigin);
    } catch (err) {
      console.error('[Trader] postMessage error:', err);
    }
  }, []);

  // Update round phase
  const setPhase = useCallback((phase: RoundPhase) => {
    phaseRef.current = phase;
    setRoundPhase(phase);
  }, []);

  // Generate simulated players for the round
  const createSimulatedTraders = useCallback((): SimulatedTrader[] => {
    const count = 5 + Math.floor(Math.random() * 4);
    const shuffled = [...MOCK_NAMES].sort(() => Math.random() - 0.5).slice(0, count);

    return shuffled.map((name, i) => {
      const bet = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 25.0][Math.floor(Math.random() * 7)];
      const target = Number((1.15 + Math.random() * 3.5).toFixed(2));
      return {
        id: `sim_${i}_${Date.now()}`,
        name,
        bet,
        targetMultiplier: target,
        status: 'TRADING',
      };
    });
  }, []);

  // Clean animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Handle market crash event (authoritative atomic execution)
  const handleMarketCrash = useCallback((crashMultiplier: number) => {
    // ATOMIC CHECK: Must strictly be LIVE
    if (phaseRef.current !== 'LIVE') return;

    setPhase('CRASHED');
    soundManager.playCrash();
    setFinalMultiplier(crashMultiplier);

    const activeRound = roundIdRef.current;

    // Add ONE history entry per round
    const histItem: HistoryItem = {
      id: `${activeRound}_${Date.now()}`,
      roundId: activeRound,
      multiplier: crashMultiplier,
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      const next = [histItem, ...prev.slice(0, 29)];
      if (!isEmbeddedRef.current) {
        try {
          localStorage.setItem(STORAGE_STANDALONE_HISTORY, JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    // Settle Slot 1: If ACTIVE, it is LOST
    const s1 = slot1Ref.current;
    if (s1.status === 'ACTIVE' && s1.requestId) {
      s1.status = 'LOST';
      setSlot1((prev) => ({ ...prev, status: 'LOST' }));

      if (isEmbeddedRef.current && !settledRequestsRef.current.has(s1.requestId)) {
        settledRequestsRef.current.add(s1.requestId);
        activeWagersRef.current.delete(s1.requestId);

        postToHost({
          type: 'TRADER_RESULT',
          gameId: 'trader',
          requestId: s1.requestId,
          roundId: activeRound,
          slotId: 'slot1',
          outcome: 'CRASH',
          multiplier: crashMultiplier,
          betAmount: s1.amount,
          payout: 0,
        });
      } else {
        settledRequestsRef.current.add(s1.requestId);
        activeWagersRef.current.delete(s1.requestId);
      }
    }

    // Settle Slot 2: If ACTIVE, it is LOST
    const s2 = slot2Ref.current;
    if (s2.status === 'ACTIVE' && s2.requestId) {
      s2.status = 'LOST';
      setSlot2((prev) => ({ ...prev, status: 'LOST' }));

      if (isEmbeddedRef.current && !settledRequestsRef.current.has(s2.requestId)) {
        settledRequestsRef.current.add(s2.requestId);
        activeWagersRef.current.delete(s2.requestId);

        postToHost({
          type: 'TRADER_RESULT',
          gameId: 'trader',
          requestId: s2.requestId,
          roundId: activeRound,
          slotId: 'slot2',
          outcome: 'CRASH',
          multiplier: crashMultiplier,
          betAmount: s2.amount,
          payout: 0,
        });
      } else {
        settledRequestsRef.current.add(s2.requestId);
        activeWagersRef.current.delete(s2.requestId);
      }
    }

    // Update simulated players: any still TRADING are now LOST
    setSimulatedTraders((prev) =>
      prev.map((bot) => (bot.status === 'TRADING' ? { ...bot, status: 'LOST' } : bot))
    );

    // Cooldown and reset to next betting round
    setTimeout(() => {
      setPhase('SETTLED');
      engineRef.current?.settle();

      // Guarantee all active wagers from this round are 0
      activeWagersRef.current.clear();

      // Reset slots to EMPTY for next round
      setSlot1((prev) => ({
        ...prev,
        status: 'EMPTY',
        requestId: null,
        transactionId: null,
        roundId: null,
        cashedMultiplier: undefined,
        payout: undefined,
      }));

      setSlot2((prev) => ({
        ...prev,
        status: 'EMPTY',
        requestId: null,
        transactionId: null,
        roundId: null,
        cashedMultiplier: undefined,
        payout: undefined,
      }));

      // Begin next round
      initNewRound();
    }, 2500);
  }, [postToHost, setPhase]);

  // Main simulation tick loop during live round
  const startSimulationLoop = useCallback(() => {
    roundStartTimeRef.current = performance.now();

    const loop = (now: number) => {
      const engine = engineRef.current;
      if (phaseRef.current !== 'LIVE' || !engine) return;

      const elapsedSeconds = (now - roundStartTimeRef.current) / 1000;
      const { state, crashedJustNow } = engine.tickTo(elapsedSeconds);
      const mult = state.currentMultiplier;

      currentMultiplierRef.current = mult;
      setCurrentMultiplier(mult);
      setTrajectory([...state.trajectory]);

      soundManager.playTick(mult);

      // Auto-cashout checks (trigger ONCE per slot)
      const s1 = slot1Ref.current;
      if (
        s1.status === 'ACTIVE' &&
        s1.autoCashoutEnabled &&
        mult >= s1.autoCashoutMultiplier &&
        !crashedJustNow
      ) {
        cashOutRef.current('slot1');
      }

      const s2 = slot2Ref.current;
      if (
        s2.status === 'ACTIVE' &&
        s2.autoCashoutEnabled &&
        mult >= s2.autoCashoutMultiplier &&
        !crashedJustNow
      ) {
        cashOutRef.current('slot2');
      }

      // Check simulated traders cashing out
      setSimulatedTraders((prev) =>
        prev.map((bot) => {
          if (bot.status === 'TRADING' && mult >= bot.targetMultiplier && !crashedJustNow) {
            return {
              ...bot,
              status: 'CASHED',
              cashedMultiplier: mult,
              winAmount: Number((bot.bet * mult).toFixed(2)),
            };
          }
          return bot;
        })
      );

      // Check crash condition
      if (crashedJustNow || state.phase === 'CRASHED') {
        currentMultiplierRef.current = state.crashMultiplier;
        setCurrentMultiplier(state.crashMultiplier);
        handleMarketCrash(state.crashMultiplier);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  }, [handleMarketCrash]);

  // Launch the live round
  const launchLiveRound = useCallback(() => {
    setPhase('LIVE');
    if (engineRef.current) {
      engineRef.current.startLive();
    }
    startSimulationLoop();
  }, [setPhase, startSimulationLoop]);

  // Initialize a completely new round with clean roundId
  const initNewRound = useCallback(() => {
    const engine = new TraderRoundEngine();
    engineRef.current = engine;
    engine.startBetting();

    const newRoundId = engine.getRoundId();
    roundIdRef.current = newRoundId;
    setRoundId(newRoundId);

    setFinalMultiplier(null);
    setCurrentMultiplier(1.0);
    currentMultiplierRef.current = 1.0;
    setTrajectory([{ t: 0, multiplier: 1.0 }]);
    setSimulatedTraders(createSimulatedTraders());

    setPhase('BETTING');

    let remaining = BETTING_COUNTDOWN_SECONDS;
    setCountdown(remaining);

    const interval = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (phaseRef.current === 'BETTING') {
          launchLiveRound();
        }
      }
    }, 1000);
  }, [createSimulatedTraders, launchLiveRound, setPhase]);

  // Initialize on mount
  useEffect(() => {
    const embedded =
      options?.forceEmbedded ?? (typeof window !== 'undefined' && window.parent !== window);
    setIsEmbedded(embedded);
    isEmbeddedRef.current = embedded;
    setSoundMuted(soundManager.isMuted());

    if (embedded) {
      // In embedded mode, balance is NOT loaded from localStorage and defaults to 0 until BETADRiX_TRADER_INIT
      setBalance(0);
      balanceRef.current = 0;
      setIsInitialized(false);
      isInitializedRef.current = false;

      const sendReady = () => {
        postToHost({
          type: 'TRADER_READY',
          game: 'trader',
          gameId: 'trader',
        });
      };

      sendReady();

      const readyInterval = setInterval(() => {
        if (!isInitializedRef.current) {
          sendReady();
        } else {
          clearInterval(readyInterval);
        }
      }, 1000);

      initNewRound();
      return () => clearInterval(readyInterval);
    } else {
      setIsInitialized(true);
      isInitializedRef.current = true;
      // Standalone mode: load saved local balance
      try {
        const savedBal = localStorage.getItem(STORAGE_STANDALONE_BALANCE);
        if (savedBal !== null && !isNaN(Number(savedBal))) {
          const parsed = Number(savedBal);
          setBalance(parsed);
          balanceRef.current = parsed;
        }
        const savedHist = localStorage.getItem(STORAGE_STANDALONE_HISTORY);
        if (savedHist) {
          setHistory(JSON.parse(savedHist));
        }
      } catch {}

      initNewRound();
    }
  }, [initNewRound, options?.forceEmbedded, postToHost]);

  // Keep balanceRef updated
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  // Reset standalone demo balance
  const resetStandaloneBalance = useCallback(() => {
    if (isEmbeddedRef.current) return;
    const defaultBal = STANDALONE_INITIAL_BALANCE;
    setBalance(defaultBal);
    balanceRef.current = defaultBal;
    try {
      localStorage.setItem(STORAGE_STANDALONE_BALANCE, String(defaultBal));
    } catch {}
    soundManager.playClick();
  }, []);

  // Toggle sound
  const toggleSound = useCallback(() => {
    const muted = soundManager.toggleMute();
    setSoundMuted(muted);
  }, []);

  // User Action: Place Bet for Slot 1 or Slot 2
  const placeBet = useCallback(
    (slotId: SlotId, amount: number) => {
      // 1. MUST be in BETTING phase
      if (phaseRef.current !== 'BETTING') return;

      // In embedded mode, betting is strictly locked until initialized by BETADRiX
      if (isEmbeddedRef.current && !isInitializedRef.current) return;

      const slot = slotId === 'slot1' ? slot1Ref.current : slot2Ref.current;
      // 2. MUST be EMPTY (prevent duplicate click/bet)
      if (slot.status !== 'EMPTY') return;

      // 3. Validate Amount
      if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
        return;
      }
      const roundedAmount = Number(amount.toFixed(2));
      if (roundedAmount < 0.1 || roundedAmount > 500) return;

      // Validate against current balance
      if (roundedAmount > balanceRef.current) {
        return;
      }

      const activeRound = roundIdRef.current;
      const requestId = `${activeRound}_${slotId}_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      if (pendingRequestsRef.current.has(requestId) || activeWagersRef.current.has(requestId)) {
        return;
      }

      pendingRequestsRef.current.add(requestId);
      soundManager.playClick();

      const updateSlot = (updater: (prev: BetSlotState) => BetSlotState) => {
        if (slotId === 'slot1') setSlot1(updater);
        else setSlot2(updater);
      };

      if (isEmbeddedRef.current) {
        // EMBEDDED MODE: Request authoritative deduction from BETADRiX host
        updateSlot((prev) => ({
          ...prev,
          amount: roundedAmount,
          status: 'BET_PENDING',
          requestId,
          transactionId,
          roundId: activeRound,
        }));

        postToHost({
          type: 'TRADER_BET_REQUEST',
          gameId: 'trader',
          requestId,
          roundId: activeRound,
          slotId,
          amount: roundedAmount,
        });
      } else {
        // STANDALONE MODE: Local wallet validation & deduction
        const nextBal = Number((balanceRef.current - roundedAmount).toFixed(2));
        setBalance(nextBal);
        balanceRef.current = nextBal;
        try {
          localStorage.setItem(STORAGE_STANDALONE_BALANCE, String(nextBal));
        } catch {}

        pendingRequestsRef.current.delete(requestId);
        activeWagersRef.current.set(requestId, {
          roundId: activeRound,
          slotId,
          amount: roundedAmount,
        });

        updateSlot((prev) => ({
          ...prev,
          amount: roundedAmount,
          status: 'ACTIVE',
          requestId,
          transactionId,
          roundId: activeRound,
        }));

        soundManager.playBetAccepted();
      }
    },
    [postToHost]
  );

  // User Action: Cash Out for Slot 1 or Slot 2
  const cashOut = useCallback(
    (slotId: SlotId) => {
      // 1. Round must be strictly LIVE
      if (phaseRef.current !== 'LIVE' || !engineRef.current) return;

      const slot = slotId === 'slot1' ? slot1Ref.current : slot2Ref.current;
      // 2. Position must be strictly ACTIVE
      if (slot.status !== 'ACTIVE' || !slot.requestId || !slot.roundId) return;

      // Authoritative cashout from simulation engine
      const outcome = engineRef.current.cashout(slotId, slot.amount);
      if (!outcome.success) return;

      // ATOMIC LOCK: Immediately transition out of ACTIVE to avoid any race condition
      slot.status = 'CASHOUT_PENDING';

      const mult = outcome.multiplier;
      const calculatedPayout = outcome.payout;
      const reqId = slot.requestId;
      const rId = slot.roundId;

      soundManager.playCashout();

      const updateSlot = (updater: (prev: BetSlotState) => BetSlotState) => {
        if (slotId === 'slot1') setSlot1(updater);
        else setSlot2(updater);
      };

      if (isEmbeddedRef.current) {
        updateSlot((prev) => ({
          ...prev,
          status: 'CASHOUT_PENDING',
          cashedMultiplier: mult,
          payout: calculatedPayout,
        }));

        // Single authoritative settlement event dispatched to host
        postToHost({
          type: 'TRADER_RESULT',
          gameId: 'trader',
          requestId: reqId,
          roundId: rId,
          slotId,
          outcome: 'CASHOUT',
          multiplier: mult,
          betAmount: slot.amount,
          payout: calculatedPayout,
        });
      } else {
        const nextBal = Number((balanceRef.current + calculatedPayout).toFixed(2));
        setBalance(nextBal);
        balanceRef.current = nextBal;
        try {
          localStorage.setItem(STORAGE_STANDALONE_BALANCE, String(nextBal));
        } catch {}

        updateSlot((prev) => ({
          ...prev,
          status: 'CASHED_OUT',
          cashedMultiplier: mult,
          payout: calculatedPayout,
        }));

        settledRequestsRef.current.add(reqId);
        activeWagersRef.current.delete(reqId);
      }
    },
    [postToHost]
  );

  useEffect(() => {
    cashOutRef.current = cashOut;
  }, [cashOut]);

  // Update Slot Amount
  const setSlotAmount = useCallback((slotId: SlotId, amount: number) => {
    const clamped = Math.max(0.1, Math.min(500, Number(amount.toFixed(2))));
    if (slotId === 'slot1') {
      setSlot1((prev) => ({ ...prev, amount: clamped }));
    } else {
      setSlot2((prev) => ({ ...prev, amount: clamped }));
    }
  }, []);

  // Update Auto-Cashout Settings
  const setAutoCashout = useCallback(
    (slotId: SlotId, enabled: boolean, multiplier?: number) => {
      const updateSlot = (updater: (prev: BetSlotState) => BetSlotState) => {
        if (slotId === 'slot1') setSlot1(updater);
        else setSlot2(updater);
      };

      updateSlot((prev) => ({
        ...prev,
        autoCashoutEnabled: enabled,
        autoCashoutMultiplier: multiplier !== undefined ? Math.max(1.05, multiplier) : prev.autoCashoutMultiplier,
      }));
    },
    []
  );

  // Inbound PostMessage Listener (Authoritative Host Protocol)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      if (!isAllowedOrigin(event.origin)) return;

      // When embedded, strictly validate event.source is window.parent
      if (
        isEmbeddedRef.current &&
        typeof window !== 'undefined' &&
        window.parent &&
        window.parent !== window &&
        event.source !== window.parent
      ) {
        return;
      }

      if (event.origin && event.origin !== 'null') {
        detectedOriginRef.current = event.origin;
        setDetectedHostOrigin(event.origin);
      }

      const data = event.data as BetadrixInboundMessage;
      if (!data || typeof data !== 'object' || !data.type) return;

      switch (data.type) {
        case 'BETADRiX_TRADER_INIT': {
          if (typeof data.balance === 'number' && !isNaN(data.balance)) {
            setBalance(data.balance);
            balanceRef.current = data.balance;
          }
          if (data.currency) setCurrency(data.currency);
          setIsInitialized(true);
          isInitializedRef.current = true;
          break;
        }

        case 'BETADRiX_BET_ACCEPTED': {
          const reqId = data.requestId;
          if (!pendingRequestsRef.current.has(reqId)) return;

          // Round isolation check
          if (data.roundId && data.roundId !== roundIdRef.current) return;

          pendingRequestsRef.current.delete(reqId);

          if (typeof data.balance === 'number') {
            setBalance(data.balance);
            balanceRef.current = data.balance;
          }

          soundManager.playBetAccepted();

          if (slot1Ref.current.requestId === reqId) {
            slot1Ref.current.status = 'ACTIVE';
            activeWagersRef.current.set(reqId, {
              roundId: slot1Ref.current.roundId || roundIdRef.current,
              slotId: 'slot1',
              amount: slot1Ref.current.amount,
            });
            setSlot1((prev) => ({ ...prev, status: 'ACTIVE' }));
          } else if (slot2Ref.current.requestId === reqId) {
            slot2Ref.current.status = 'ACTIVE';
            activeWagersRef.current.set(reqId, {
              roundId: slot2Ref.current.roundId || roundIdRef.current,
              slotId: 'slot2',
              amount: slot2Ref.current.amount,
            });
            setSlot2((prev) => ({ ...prev, status: 'ACTIVE' }));
          }
          break;
        }

        case 'BETADRiX_BET_REJECTED': {
          const reqId = data.requestId;
          if (pendingRequestsRef.current.has(reqId)) {
            pendingRequestsRef.current.delete(reqId);
          }

          if (slot1Ref.current.requestId === reqId) {
            slot1Ref.current.status = 'EMPTY';
            setSlot1((prev) => ({ ...prev, status: 'EMPTY', requestId: null }));
          } else if (slot2Ref.current.requestId === reqId) {
            slot2Ref.current.status = 'EMPTY';
            setSlot2((prev) => ({ ...prev, status: 'EMPTY', requestId: null }));
          }
          break;
        }

        case 'BETADRiX_RESULT_SETTLED': {
          const reqId = data.requestId;
          if (settledRequestsRef.current.has(reqId)) return;

          // Round isolation check
          const targetSlot =
            slot1Ref.current.requestId === reqId
              ? slot1Ref.current
              : slot2Ref.current.requestId === reqId
              ? slot2Ref.current
              : null;

          if (data.roundId && targetSlot && targetSlot.roundId && data.roundId !== targetSlot.roundId) {
            return;
          }

          settledRequestsRef.current.add(reqId);
          activeWagersRef.current.delete(reqId);

          if (typeof data.balance === 'number' && !isNaN(data.balance)) {
            setBalance(data.balance);
            balanceRef.current = data.balance;
          }

          if (slot1Ref.current.requestId === reqId) {
            setSlot1((prev) => ({
              ...prev,
              status: prev.cashedMultiplier ? 'CASHED_OUT' : 'LOST',
              payout: data.payout !== undefined ? data.payout : prev.payout,
            }));
          } else if (slot2Ref.current.requestId === reqId) {
            setSlot2((prev) => ({
              ...prev,
              status: prev.cashedMultiplier ? 'CASHED_OUT' : 'LOST',
              payout: data.payout !== undefined ? data.payout : prev.payout,
            }));
          }
          break;
        }

        case 'BETADRiX_BALANCE_UPDATE': {
          if (typeof data.balance === 'number' && !isNaN(data.balance)) {
            setBalance(data.balance);
            balanceRef.current = data.balance;
          }
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return {
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
    detectedHostOrigin,
    slot1,
    slot2,
    trajectory,
    placeBet,
    cashOut,
    setSlotAmount,
    setAutoCashout,
    resetStandaloneBalance,
    toggleSound,
  };
}
