export type RoundPhase = 'BETTING' | 'LIVE' | 'CRASHED' | 'SETTLED';

export type SlotId = 'slot1' | 'slot2';

export type SlotStatus =
  | 'EMPTY'
  | 'BET_PENDING'
  | 'ACTIVE'
  | 'CASHOUT_PENDING'
  | 'CASHED_OUT'
  | 'LOST'
  | 'REJECTED';

export type OutcomeType = 'CASHOUT' | 'CRASH';

export interface TrajectoryPoint {
  t: number;
  multiplier: number;
}

export interface Position {
  transactionId: string;
  requestId: string;
  roundId: string;
  slotId: SlotId;
  amount: number;
  status: SlotStatus;
  createdAt: number;
  cashoutMultiplier?: number;
  payout?: number;
  settledAt?: number;
}

export interface BetSlotState {
  id: SlotId;
  label: string;
  amount: number;
  status: SlotStatus;
  requestId: string | null;
  transactionId: string | null;
  roundId: string | null;
  cashedMultiplier?: number;
  payout?: number;
  autoCashoutEnabled: boolean;
  autoCashoutMultiplier: number;
}

// PostMessage Inbound & Outbound Types
export type TraderReadyMessage = {
  type: 'TRADER_READY';
};

export type BetadrixInitMessage = {
  type: 'BETADRiX_TRADER_INIT';
  balance: number;
  currency: string;
};

export type TraderBetRequestMessage = {
  type: 'TRADER_BET_REQUEST';
  requestId: string;
  roundId: string;
  slotId: SlotId;
  amount: number;
};

export type BetadrixBetAcceptedMessage = {
  type: 'BETADRiX_BET_ACCEPTED';
  requestId: string;
  roundId?: string;
  slotId?: SlotId;
  amount: number;
  balance: number;
};

export type BetadrixBetRejectedMessage = {
  type: 'BETADRiX_BET_REJECTED';
  requestId: string;
  roundId?: string;
  slotId?: SlotId;
  reason: string;
};

export type TraderCashoutRequestMessage = {
  type: 'TRADER_CASHOUT_REQUEST';
  requestId: string;
  roundId: string;
  slotId: SlotId;
  multiplier: number;
};

export type TraderResultMessage = {
  type: 'TRADER_RESULT';
  requestId: string;
  roundId: string;
  slotId: SlotId;
  outcome: OutcomeType;
  multiplier: number;
};

export type BetadrixResultSettledMessage = {
  type: 'BETADRiX_RESULT_SETTLED';
  requestId: string;
  roundId?: string;
  slotId?: SlotId;
  betAmount: number;
  payout: number;
  balance: number;
};

export type BetadrixBalanceUpdateMessage = {
  type: 'BETADRiX_BALANCE_UPDATE';
  balance: number;
};

export type BetadrixInboundMessage =
  | BetadrixInitMessage
  | BetadrixBetAcceptedMessage
  | BetadrixBetRejectedMessage
  | BetadrixResultSettledMessage
  | BetadrixBalanceUpdateMessage;

export type TraderOutboundMessage =
  | TraderReadyMessage
  | TraderBetRequestMessage
  | TraderCashoutRequestMessage
  | TraderResultMessage;

export interface HistoryItem {
  id: string;
  roundId: string;
  multiplier: number;
  timestamp: number;
}

export interface SimulatedTrader {
  id: string;
  name: string;
  bet: number;
  targetMultiplier: number;
  status: 'TRADING' | 'CASHED' | 'LOST';
  cashedMultiplier?: number;
  winAmount?: number;
}
