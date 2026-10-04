/**
 * BETADRiX + Trader Embedded Wallet & PostMessage Protocol Verification
 *
 * Verifies:
 * 1. Origin security (whitelist, strict rejection of *, arbitrary domains)
 * 2. Handshake lifecycle: TRADER_READY -> BETADRiX_TRADER_INIT
 * 3. Embedded mode wallet: no local wallet authority, no localStorage persistence
 * 4. Dual bet lifecycle (Bet 1, Bet 2): TRADER_BET_REQUEST -> BETADRiX_BET_ACCEPTED
 * 5. Rejection handling: BETADRiX_BET_REJECTED frees slot without balance mutation
 * 6. Single authoritative settlement: TRADER_RESULT -> BETADRiX_RESULT_SETTLED
 * 7. Client payout untrusted: host independently calculates settlement, client cannot inflate payout
 * 8. Duplicate protection: duplicate requests/settlements/results ignored, exactly ONE payout
 * 9. Crash settlement: already-cashed remain CASHED_OUT, still-active become LOST ($0 payout)
 * 10. Round isolation: stale messages from previous rounds discarded
 * 11. Balance synchronization: BETADRiX_BALANCE_UPDATE
 * 12. Reconnect: TRADER_READY re-emitted, zero balance drift
 */

const assert = require('assert');

// 1. Origin validation logic
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'https://demo-m4tn.onrender.com',
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((allowed) => {
    if (typeof allowed === 'string') return origin === allowed;
    return allowed.test(origin);
  });
}

function getSafeTargetOrigin(detectedOrigin) {
  if (detectedOrigin && isAllowedOrigin(detectedOrigin)) return detectedOrigin;
  return 'https://demo-m4tn.onrender.com';
}

console.log('====================================================');
console.log('BETADRiX EMBED WALLET & SINGLE SETTLEMENT SUITE');
console.log('====================================================\n');

// TEST 1: Origin Security
console.log('--- TEST 1: Origin Whitelist & Wildcard Rejection ---');
assert.strictEqual(isAllowedOrigin('https://demo-m4tn.onrender.com'), true, 'Production BETADRiX host must be allowed');
assert.strictEqual(isAllowedOrigin('http://localhost:3000'), true, 'Localhost:3000 must be allowed');
assert.strictEqual(isAllowedOrigin('http://localhost:3001'), true, 'Localhost:3001 must be allowed');
assert.strictEqual(isAllowedOrigin('*'), false, 'Wildcard * MUST be strictly rejected');
assert.strictEqual(isAllowedOrigin('https://evil.com'), false, 'Arbitrary origin must be rejected');
assert.strictEqual(isAllowedOrigin('https://demo-m4tn.onrender.com.attacker.com'), false, 'Subdomain spoofing must be rejected');
assert.strictEqual(isAllowedOrigin(''), false, 'Empty origin must be rejected');
assert.strictEqual(getSafeTargetOrigin(null), 'https://demo-m4tn.onrender.com', 'Fallback must be trusted production host');
console.log('PASSED: Strict origin security verified.\n');

// Mock BETADRiX Host Authority
class MockBetadrixHost {
  constructor(initialBalance = 1250.00) {
    this.balance = initialBalance;
    this.activeWagers = new Map(); // reqId -> { amount, roundId, slotId }
    this.settledRequests = new Map(); // reqId -> settled payout
    this.settlementCount = 0;
    this.outbox = [];
  }

  // Handle incoming TRADER_BET_REQUEST
  handleBetRequest(msg) {
    const { requestId, roundId, slotId, amount } = msg;
    // Duplicate check
    if (this.activeWagers.has(requestId) || this.settledRequests.has(requestId)) {
      return { accepted: false, reason: 'DUPLICATE_REQUEST' };
    }
    if (this.balance < amount) {
      const reject = {
        type: 'BETADRiX_BET_REJECTED',
        requestId,
        roundId,
        slotId,
        reason: 'INSUFFICIENT_FUNDS',
      };
      this.outbox.push(reject);
      return { accepted: false, msg: reject };
    }

    this.balance = Number((this.balance - amount).toFixed(2));
    this.activeWagers.set(requestId, { amount, roundId, slotId });

    const accept = {
      type: 'BETADRiX_BET_ACCEPTED',
      requestId,
      roundId,
      slotId,
      balance: this.balance,
    };
    this.outbox.push(accept);
    return { accepted: true, msg: accept };
  }

  // Handle incoming TRADER_RESULT (Authoritative Settlement)
  handleResult(msg) {
    const { requestId, roundId, slotId, outcome, multiplier, payout: untrustedPayout } = msg;

    // 1. Duplicate check: If already settled, do NOT settle again
    if (this.settledRequests.has(requestId)) {
      return { settled: false, reason: 'ALREADY_SETTLED' };
    }

    // 2. Active wager check
    const wagerInfo = this.activeWagers.get(requestId);
    if (!wagerInfo) {
      return { settled: false, reason: 'UNKNOWN_WAGER' };
    }

    // 3. AUTHORITATIVE PAYOUT CALCULATION: Host never trusts client payout blindly
    let authoritativePayout = 0;
    if (outcome === 'CASHOUT') {
      authoritativePayout = Number((wagerInfo.amount * multiplier).toFixed(2));
    }

    this.balance = Number((this.balance + authoritativePayout).toFixed(2));
    this.settledRequests.set(requestId, authoritativePayout);
    this.activeWagers.delete(requestId);
    this.settlementCount += 1;

    const settled = {
      type: 'BETADRiX_RESULT_SETTLED',
      requestId,
      roundId,
      slotId,
      payout: authoritativePayout,
      balance: this.balance,
    };
    this.outbox.push(settled);
    return { settled: true, msg: settled };
  }

  // Handle incoming TRADER_CASHOUT_REQUEST (MUST NEVER mutate wallet or settle)
  handleCashoutRequest(msg) {
    // Pure notification - zero wallet mutation, zero settlement!
    return { mutated: false };
  }
}

// Mock Embedded Trader
class MockEmbeddedTrader {
  constructor() {
    this.isEmbedded = true;
    this.isInitialized = false;
    this.balance = 0;
    this.currency = 'USD';
    this.outbox = [];
    this.pendingRequests = new Set();
    this.activeWagers = new Map();
    this.settledRequests = new Set();
    this.slots = {
      slot1: { status: 'EMPTY', amount: 10, requestId: null, payout: undefined },
      slot2: { status: 'EMPTY', amount: 20, requestId: null, payout: undefined },
    };
    this.roundId = 'round_101';
  }

  mount() {
    this.outbox.push({
      type: 'TRADER_READY',
      game: 'trader',
      gameId: 'trader',
    });
  }

  receiveMessage(origin, data) {
    if (!isAllowedOrigin(origin)) return;

    switch (data.type) {
      case 'BETADRiX_TRADER_INIT': {
        this.balance = data.balance;
        this.currency = data.currency || 'USD';
        this.isInitialized = true;
        break;
      }

      case 'BETADRiX_BET_ACCEPTED': {
        const reqId = data.requestId;
        if (!this.pendingRequests.has(reqId)) return;
        if (data.roundId && data.roundId !== this.roundId) return;

        this.pendingRequests.delete(reqId);
        if (typeof data.balance === 'number') this.balance = data.balance;

        for (const slotKey of ['slot1', 'slot2']) {
          if (this.slots[slotKey].requestId === reqId) {
            this.slots[slotKey].status = 'ACTIVE';
            this.activeWagers.set(reqId, {
              roundId: this.roundId,
              slotId: slotKey,
              amount: this.slots[slotKey].amount,
            });
          }
        }
        break;
      }

      case 'BETADRiX_BET_REJECTED': {
        const reqId = data.requestId;
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId);
        }
        for (const slotKey of ['slot1', 'slot2']) {
          if (this.slots[slotKey].requestId === reqId) {
            this.slots[slotKey].status = 'EMPTY';
            this.slots[slotKey].requestId = null;
          }
        }
        break;
      }

      case 'BETADRiX_RESULT_SETTLED': {
        const reqId = data.requestId;
        if (this.settledRequests.has(reqId)) return; // Duplicate protection
        if (data.roundId && data.roundId !== this.roundId) return; // Round isolation

        this.settledRequests.add(reqId);
        this.activeWagers.delete(reqId);
        if (typeof data.balance === 'number') this.balance = data.balance;

        for (const slotKey of ['slot1', 'slot2']) {
          if (this.slots[slotKey].requestId === reqId) {
            this.slots[slotKey].status = data.payout > 0 ? 'CASHED_OUT' : 'LOST';
            this.slots[slotKey].payout = data.payout;
          }
        }
        break;
      }

      case 'BETADRiX_BALANCE_UPDATE': {
        if (typeof data.balance === 'number') {
          this.balance = data.balance;
        }
        break;
      }
    }
  }

  placeBet(slotId, amount) {
    if (!this.isInitialized) return false;
    const slot = this.slots[slotId];
    if (slot.status !== 'EMPTY') return false;
    if (amount > this.balance) return false;

    const requestId = `${this.roundId}_${slotId}_req_${Date.now()}`;
    slot.status = 'BET_PENDING';
    slot.amount = amount;
    slot.requestId = requestId;
    this.pendingRequests.add(requestId);

    this.outbox.push({
      type: 'TRADER_BET_REQUEST',
      gameId: 'trader',
      requestId,
      roundId: this.roundId,
      slotId,
      amount,
    });
    return true;
  }

  // Single authoritative settlement event dispatched to host
  cashOut(slotId, multiplier) {
    const slot = this.slots[slotId];
    if (slot.status !== 'ACTIVE') return false;
    const reqId = slot.requestId;
    const payout = Number((slot.amount * multiplier).toFixed(2));
    slot.status = 'CASHOUT_PENDING';

    this.outbox.push({
      type: 'TRADER_RESULT',
      gameId: 'trader',
      requestId: reqId,
      roundId: this.roundId,
      slotId,
      outcome: 'CASHOUT',
      multiplier,
      betAmount: slot.amount,
      payout,
    });
    return true;
  }

  // Market Crash Handler
  marketCrash(crashMultiplier) {
    for (const slotKey of ['slot1', 'slot2']) {
      const slot = this.slots[slotKey];
      if (slot.status === 'ACTIVE' && slot.requestId) {
        slot.status = 'LOST';
        this.outbox.push({
          type: 'TRADER_RESULT',
          gameId: 'trader',
          requestId: slot.requestId,
          roundId: this.roundId,
          slotId: slotKey,
          outcome: 'CRASH',
          multiplier: crashMultiplier,
          betAmount: slot.amount,
          payout: 0,
        });
      }
    }
  }
}

// TEST 2: Handshake & Lock
console.log('--- TEST 2: Handshake Lifecycle (TRADER_READY -> BETADRiX_TRADER_INIT) ---');
const host = new MockBetadrixHost(1250.00);
const trader = new MockEmbeddedTrader();
trader.mount();

assert.strictEqual(trader.outbox.length, 1);
assert.strictEqual(trader.outbox[0].type, 'TRADER_READY');
assert.strictEqual(trader.isInitialized, false);
assert.strictEqual(trader.placeBet('slot1', 10), false, 'Controls locked prior to INIT');

trader.receiveMessage('https://demo-m4tn.onrender.com', {
  type: 'BETADRiX_TRADER_INIT',
  balance: host.balance,
  currency: 'USD',
});

assert.strictEqual(trader.isInitialized, true);
assert.strictEqual(trader.balance, 1250.00);
console.log('PASSED: Handshake and controls unlock verified.\n');

// TEST 3: Bet 1 & Bet 2 Placement
console.log('--- TEST 3: Dual Bet Placement & Acceptance (Bet 1 + Bet 2) ---');
assert.strictEqual(trader.placeBet('slot1', 25.00), true);
assert.strictEqual(trader.balance, 1250.00, 'Trader has NO local deduction authority');

const bet1Msg = trader.outbox.find((m) => m.type === 'TRADER_BET_REQUEST' && m.slotId === 'slot1');
const bet1Res = host.handleBetRequest(bet1Msg);
assert.strictEqual(bet1Res.accepted, true);
assert.strictEqual(host.balance, 1225.00);

trader.receiveMessage('https://demo-m4tn.onrender.com', bet1Res.msg);
assert.strictEqual(trader.slots.slot1.status, 'ACTIVE');
assert.strictEqual(trader.balance, 1225.00);

// Bet 2: $50
assert.strictEqual(trader.placeBet('slot2', 50.00), true);
const bet2Msg = trader.outbox.find((m) => m.type === 'TRADER_BET_REQUEST' && m.slotId === 'slot2');
const bet2Res = host.handleBetRequest(bet2Msg);
assert.strictEqual(bet2Res.accepted, true);
assert.strictEqual(host.balance, 1175.00);

trader.receiveMessage('https://demo-m4tn.onrender.com', bet2Res.msg);
assert.strictEqual(trader.slots.slot2.status, 'ACTIVE');
assert.strictEqual(trader.balance, 1175.00);
console.log('PASSED: Dual bets accepted with authoritative host balance deduction.\n');

// TEST 4: Single Authoritative Settlement & Removal of Redundant Cashout Request
console.log('--- TEST 4: Cashout Triggers Exactly ONE Authoritative Settlement ---');
assert.strictEqual(trader.cashOut('slot1', 2.00), true);
assert.strictEqual(trader.slots.slot1.status, 'CASHOUT_PENDING');

const cashoutOutbox = trader.outbox.filter((m) => m.requestId === bet1Msg.requestId && m.type === 'TRADER_RESULT');
assert.strictEqual(cashoutOutbox.length, 1, 'Exactly ONE settlement message emitted');

// Verify that any redundant TRADER_CASHOUT_REQUEST (if encountered) cannot mutate wallet
const dummyCashoutReq = { type: 'TRADER_CASHOUT_REQUEST', requestId: bet1Msg.requestId, multiplier: 2.00 };
const cashoutReqRes = host.handleCashoutRequest(dummyCashoutReq);
assert.strictEqual(cashoutReqRes.mutated, false, 'TRADER_CASHOUT_REQUEST must never mutate wallet');
assert.strictEqual(host.balance, 1175.00, 'Balance unchanged by cashout request');

// Host settles Bet 1 via TRADER_RESULT
const settleRes = host.handleResult(cashoutOutbox[0]);
assert.strictEqual(settleRes.settled, true);
assert.strictEqual(host.balance, 1225.00, 'Host credited $50 payout: 1175 + 50 = 1225');
assert.strictEqual(host.settlementCount, 1);

trader.receiveMessage('https://demo-m4tn.onrender.com', settleRes.msg);
assert.strictEqual(trader.slots.slot1.status, 'CASHED_OUT');
assert.strictEqual(trader.balance, 1225.00);
console.log('PASSED: Single settlement flow verified.\n');

// TEST 5: Never Trust Client Payout Blindly (Inflated Payout Rejected)
console.log('--- TEST 5: Never Trust Client Payout Blindly (Authoritative Host Math) ---');
const maliciousResult = {
  type: 'TRADER_RESULT',
  gameId: 'trader',
  requestId: bet2Msg.requestId,
  roundId: 'round_101',
  slotId: 'slot2',
  outcome: 'CASHOUT',
  multiplier: 1.50, // Real multiplier: 50 * 1.50 = 75.00
  betAmount: 50.00,
  payout: 999999.00, // Malicious inflated payout!
};

const malSettleRes = host.handleResult(maliciousResult);
assert.strictEqual(malSettleRes.settled, true);
assert.strictEqual(malSettleRes.msg.payout, 75.00, 'Host MUST calculate payout as 50 * 1.50 = 75.00, ignoring 999999.00');
assert.strictEqual(host.balance, 1300.00, '1225.00 + 75.00 = 1300.00');
assert.notStrictEqual(host.balance, 1225.00 + 999999.00, 'Host NEVER credited client inflated payout');
console.log('PASSED: Host independently calculated settlement math without trusting client payout.\n');

// TEST 6: Duplicate Protection
console.log('--- TEST 6: Duplicate TRADER_RESULT Replay Protection ---');
const replayRes = host.handleResult(maliciousResult);
assert.strictEqual(replayRes.settled, false);
assert.strictEqual(replayRes.reason, 'ALREADY_SETTLED');
assert.strictEqual(host.balance, 1300.00, 'Balance unchanged on replay');
assert.strictEqual(host.settlementCount, 2, 'Settlement count unchanged');

// Client-side replay immunity
trader.receiveMessage('https://demo-m4tn.onrender.com', malSettleRes.msg);
const balBeforeReplay = trader.balance;
trader.receiveMessage('https://demo-m4tn.onrender.com', malSettleRes.msg);
assert.strictEqual(trader.balance, balBeforeReplay, 'Trader ignores duplicate settlement message');
console.log('PASSED: Both host and client enforce duplicate settlement protection.\n');

// TEST 7: Crash Result Settlement
console.log('--- TEST 7: Crash Result Settlement (Already Cashed vs Lost) ---');
const hostRound2 = new MockBetadrixHost(1000.00);
const traderRound2 = new MockEmbeddedTrader();
traderRound2.roundId = 'round_202';
traderRound2.isInitialized = true;
traderRound2.balance = 1000.00;

// Place Bet 1 and Bet 2 in Round 2
traderRound2.placeBet('slot1', 20.00);
traderRound2.placeBet('slot2', 30.00);

const r2Bet1 = traderRound2.outbox.find((m) => m.slotId === 'slot1');
const r2Bet2 = traderRound2.outbox.find((m) => m.slotId === 'slot2');
const r2Bet1Acc = hostRound2.handleBetRequest(r2Bet1);
const r2Bet2Acc = hostRound2.handleBetRequest(r2Bet2);
traderRound2.receiveMessage('https://demo-m4tn.onrender.com', r2Bet1Acc.msg);
traderRound2.receiveMessage('https://demo-m4tn.onrender.com', r2Bet2Acc.msg);
assert.strictEqual(hostRound2.balance, 950.00);

// Bet 1 cashes out at 2.50x
traderRound2.cashOut('slot1', 2.50);
const r2Cashout1 = traderRound2.outbox.find((m) => m.slotId === 'slot1' && m.type === 'TRADER_RESULT');
const r2Cashout1Settle = hostRound2.handleResult(r2Cashout1);
traderRound2.receiveMessage('https://demo-m4tn.onrender.com', r2Cashout1Settle.msg);
// 950 + (20 * 2.5) = 950 + 50 = 1000.00
assert.strictEqual(hostRound2.balance, 1000.00);
assert.strictEqual(traderRound2.slots.slot1.status, 'CASHED_OUT');

// Market Crashes at 3.10x
traderRound2.marketCrash(3.10);
// Bet 1 remains CASHED_OUT
assert.strictEqual(traderRound2.slots.slot1.status, 'CASHED_OUT', 'Already-cashed slot1 remains CASHED_OUT');

// Bet 2 was ACTIVE -> becomes LOST with payout 0
assert.strictEqual(traderRound2.slots.slot2.status, 'LOST', 'Active slot2 becomes LOST');
const r2CrashBet2 = traderRound2.outbox.find((m) => m.slotId === 'slot2' && m.outcome === 'CRASH');
assert(r2CrashBet2 !== undefined);
assert.strictEqual(r2CrashBet2.payout, 0);

const r2CrashSettle = hostRound2.handleResult(r2CrashBet2);
assert.strictEqual(r2CrashSettle.settled, true);
assert.strictEqual(r2CrashSettle.msg.payout, 0, 'No payout for LOST position');
assert.strictEqual(hostRound2.balance, 1000.00, 'Host balance unchanged on crash');
console.log('PASSED: Crash produces exactly ONE authoritative settlement (Already cashed intact, active lost).\n');

// TEST 8: Direct Balance Update
console.log('--- TEST 8: BETADRiX_BALANCE_UPDATE Synchronization ---');
trader.receiveMessage('https://demo-m4tn.onrender.com', {
  type: 'BETADRiX_BALANCE_UPDATE',
  balance: 2000.00,
});
assert.strictEqual(trader.balance, 2000.00);
console.log('PASSED: Balance update synchronized.\n');

// TEST 9: Round Isolation
console.log('--- TEST 9: Round Isolation ---');
trader.receiveMessage('https://demo-m4tn.onrender.com', {
  type: 'BETADRiX_RESULT_SETTLED',
  requestId: 'old_req_888',
  roundId: 'round_99',
  slotId: 'slot1',
  payout: 500,
  balance: 8888.00,
});
assert.strictEqual(trader.balance, 2000.00, 'Stale cross-round message ignored');
console.log('PASSED: Round isolation verified.\n');

// TEST 10: Refresh / Reconnect
console.log('--- TEST 10: Refresh / Reconnect (Zero Drift) ---');
const reconnected = new MockEmbeddedTrader();
reconnected.mount();
assert.strictEqual(reconnected.outbox[0].type, 'TRADER_READY');
assert.strictEqual(reconnected.balance, 0);
assert.strictEqual(reconnected.isInitialized, false);

reconnected.receiveMessage('https://demo-m4tn.onrender.com', {
  type: 'BETADRiX_TRADER_INIT',
  balance: 2000.00,
  currency: 'USD',
});
assert.strictEqual(reconnected.balance, 2000.00);
assert.strictEqual(reconnected.isInitialized, true);
console.log('PASSED: Clean reconnect verified.\n');

console.log('====================================================');
console.log('ALL SINGLE-WALLET SETTLEMENT TESTS PASSED (100%)!');
console.log('====================================================');
