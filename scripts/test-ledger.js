// Deterministic Ledger and Multi-Bet Integration Test
const assert = require('assert');

console.log('====================================================');
console.log('TRADER GAME LOGIC & TRANSACTION LEDGER TEST SUITE');
console.log('====================================================\n');

class MockBetadrixHost {
  constructor(initialBalance = 1250.00) {
    this.balance = initialBalance;
    this.activeWagers = new Map(); // requestId -> { roundId, slotId, amount }
    this.settledIds = new Set();
    this.history = [];
    this.log = [];
  }

  handleBetRequest(data) {
    const { requestId, roundId, slotId, amount } = data;

    // Idempotency: Reject duplicate requestId
    if (this.activeWagers.has(requestId) || this.settledIds.has(requestId)) {
      this.log.push(`[REJECTED_DUPLICATE] requestId: ${requestId}`);
      return { accepted: false, reason: 'DUPLICATE_REQUEST' };
    }

    // Balance check
    if (amount > this.balance) {
      this.log.push(`[REJECTED_INSUFFICIENT] amount: ${amount}, balance: ${this.balance}`);
      return { accepted: false, reason: 'INSUFFICIENT_BALANCE' };
    }

    // Authoritative deduction
    this.balance = Number((this.balance - amount).toFixed(2));
    this.activeWagers.set(requestId, { roundId, slotId, amount });
    this.log.push(`[BET_ACCEPTED] slot: ${slotId}, amount: $${amount}, new balance: $${this.balance}`);

    return {
      accepted: true,
      requestId,
      roundId,
      slotId,
      amount,
      balance: this.balance,
    };
  }

  handleResult(data) {
    const { requestId, roundId, slotId, outcome, multiplier } = data;

    // Idempotency: Reject duplicate settlement
    if (this.settledIds.has(requestId)) {
      this.log.push(`[REJECTED_DUPLICATE_SETTLEMENT] requestId: ${requestId}`);
      return { settled: false, reason: 'ALREADY_SETTLED' };
    }

    const position = this.activeWagers.get(requestId);
    const wager = position ? position.amount : 0;
    let payout = 0;

    if (outcome === 'CASHOUT') {
      payout = Number((wager * multiplier).toFixed(2));
      this.balance = Number((this.balance + payout).toFixed(2));
    }

    // Decrement active wager
    this.activeWagers.delete(requestId);
    this.settledIds.add(requestId);

    this.log.push(
      `[SETTLED] slot: ${slotId}, outcome: ${outcome}, mult: ${multiplier}x, payout: $${payout}, balance: $${this.balance}`
    );

    return {
      settled: true,
      requestId,
      roundId,
      slotId,
      betAmount: wager,
      payout,
      balance: this.balance,
    };
  }

  recordRoundEnd(roundId, crashMultiplier) {
    // Settle all remaining active bets for this round as LOST
    for (const [reqId, pos] of Array.from(this.activeWagers.entries())) {
      if (pos.roundId === roundId) {
        this.handleResult({
          requestId: reqId,
          roundId,
          slotId: pos.slotId,
          outcome: 'CRASH',
          multiplier: crashMultiplier,
        });
      }
    }
    this.history.unshift({ roundId, multiplier: crashMultiplier });
  }
}

// EXECUTE TEST SCENARIO
const host = new MockBetadrixHost(1250.00);

console.log('--- TEST 1: Dual Bets in Round 1 ---');
const r1 = 'round_1042';
const bet1 = host.handleBetRequest({ requestId: `${r1}_slot1_reqA`, roundId: r1, slotId: 'slot1', amount: 25 });
const bet2 = host.handleBetRequest({ requestId: `${r1}_slot2_reqB`, roundId: r1, slotId: 'slot2', amount: 25 });

console.log(`Initial Balance: $1,250.00`);
console.log(`Balance after Bet 1 ($25) and Bet 2 ($25): $${host.balance.toFixed(2)} (Expected: 1200.00)`);
console.log(`Active Wagers: ${host.activeWagers.size} (Expected: 2)`);
assert.strictEqual(host.balance, 1200.00, 'Balance must be $1,200.00');
assert.strictEqual(host.activeWagers.size, 2, 'Active wagers must be 2');

console.log('\n--- TEST 2: Duplicate Bet Prevention ---');
const dupBet = host.handleBetRequest({ requestId: `${r1}_slot1_reqA`, roundId: r1, slotId: 'slot1', amount: 25 });
console.log(`Duplicate Bet Accepted? ${dupBet.accepted} (Expected: false)`);
console.log(`Balance after duplicate attempt: $${host.balance.toFixed(2)} (Expected: 1200.00)`);
console.log(`Active Wagers after duplicate attempt: ${host.activeWagers.size} (Expected: 2)`);
assert.strictEqual(dupBet.accepted, false, 'Duplicate bet must be rejected');
assert.strictEqual(host.balance, 1200.00, 'Balance must not change on duplicate bet');
assert.strictEqual(host.activeWagers.size, 2, 'Active wagers must remain 2');

console.log('\n--- TEST 3: Cash Out Bet 1 at 1.50x ---');
const cashout1 = host.handleResult({
  requestId: `${r1}_slot1_reqA`,
  roundId: r1,
  slotId: 'slot1',
  outcome: 'CASHOUT',
  multiplier: 1.50,
});
console.log(`Bet 1 Payout: $${cashout1.payout.toFixed(2)} (Expected: 37.50)`);
console.log(`Balance after Bet 1 cashout: $${host.balance.toFixed(2)} (Expected: 1237.50)`);
console.log(`Active Wagers after Bet 1 cashout: ${host.activeWagers.size} (Expected: 1)`);
assert.strictEqual(cashout1.payout, 37.50, 'Payout must be $37.50');
assert.strictEqual(host.balance, 1237.50, 'Balance must be $1,237.50');
assert.strictEqual(host.activeWagers.size, 1, 'Active wagers must be 1');

console.log('\n--- TEST 4: Duplicate Cashout Prevention ---');
const dupCashout = host.handleResult({
  requestId: `${r1}_slot1_reqA`,
  roundId: r1,
  slotId: 'slot1',
  outcome: 'CASHOUT',
  multiplier: 1.50,
});
console.log(`Duplicate Cashout Settled? ${dupCashout.settled} (Expected: false)`);
console.log(`Balance after duplicate cashout attempt: $${host.balance.toFixed(2)} (Expected: 1237.50)`);
assert.strictEqual(dupCashout.settled, false, 'Duplicate cashout must be rejected');
assert.strictEqual(host.balance, 1237.50, 'Balance must not increase on duplicate cashout');

console.log('\n--- TEST 5: Market Crash at 3.00x (Bet 2 Loses) ---');
host.recordRoundEnd(r1, 3.00);
console.log(`Balance after Bet 2 crash: $${host.balance.toFixed(2)} (Expected: 1237.50)`);
console.log(`Active Wagers after Round 1 settlement: ${host.activeWagers.size} (Expected: 0)`);
assert.strictEqual(host.balance, 1237.50, 'Balance must remain $1,237.50 on loss');
assert.strictEqual(host.activeWagers.size, 0, 'Active wagers must be exactly 0 after settlement');

console.log('\n--- TEST 6: Round 2 Bet and Settle ---');
const r2 = 'round_1043';
const r2Bet1 = host.handleBetRequest({ requestId: `${r2}_slot1_reqC`, roundId: r2, slotId: 'slot1', amount: 25 });
console.log(`Balance after Round 2 Bet 1 ($25): $${host.balance.toFixed(2)} (Expected: 1212.50)`);
console.log(`Active Wagers in Round 2: ${host.activeWagers.size} (Expected: 1)`);
assert.strictEqual(host.balance, 1212.50, 'Balance must be $1,212.50');
assert.strictEqual(host.activeWagers.size, 1, 'Active wagers must be 1');

const r2Cashout = host.handleResult({
  requestId: `${r2}_slot1_reqC`,
  roundId: r2,
  slotId: 'slot1',
  outcome: 'CASHOUT',
  multiplier: 1.50,
});
console.log(`Round 2 Bet 1 Cashout at 1.50x Payout: $${r2Cashout.payout.toFixed(2)} (Expected: 37.50)`);
console.log(`Balance after Round 2 Cashout: $${host.balance.toFixed(2)} (Expected: 1250.00)`);
console.log(`Active Wagers after Round 2 Settlement: ${host.activeWagers.size} (Expected: 0)`);
assert.strictEqual(host.balance, 1250.00, 'Balance must return to $1,250.00');
assert.strictEqual(host.activeWagers.size, 0, 'Active wagers must be exactly 0');

console.log('\n--- TEST 7: Unequal Dual Bets ($25 + $50 = $75 total deduction) ---');
const r3 = 'round_1044';
const r3Host = new MockBetadrixHost(1250.00);
r3Host.handleBetRequest({ requestId: `${r3}_slot1_req`, roundId: r3, slotId: 'slot1', amount: 25 });
r3Host.handleBetRequest({ requestId: `${r3}_slot2_req`, roundId: r3, slotId: 'slot2', amount: 50 });
console.log(`Initial: $1,250.00 | After Bet 1 ($25) + Bet 2 ($50): $${r3Host.balance.toFixed(2)} (Expected: 1175.00)`);
console.log(`Active Wagers: ${r3Host.activeWagers.size} (Expected: 2)`);
assert.strictEqual(r3Host.balance, 1175.00, 'Balance must be $1,175.00 after $75 total deduction');
assert.strictEqual(r3Host.activeWagers.size, 2, 'Active wagers must be 2');

// Cashout Bet 1 at 2.00x ($50 payout)
const r3Cashout = r3Host.handleResult({
  requestId: `${r3}_slot1_req`,
  roundId: r3,
  slotId: 'slot1',
  outcome: 'CASHOUT',
  multiplier: 2.00,
});
console.log(`Bet 1 Cashout at 2.00x: Payout $${r3Cashout.payout.toFixed(2)} | Balance: $${r3Host.balance.toFixed(2)} (Expected: 1225.00)`);
assert.strictEqual(r3Cashout.payout, 50.00, 'Bet 1 payout must be $50.00');
assert.strictEqual(r3Host.balance, 1225.00, 'Balance must be $1,225.00');
assert.strictEqual(r3Host.activeWagers.size, 1, 'Active wagers must decrease to 1');

// Market Crash at 3.00x (Bet 2 loses)
r3Host.recordRoundEnd(r3, 3.00);
console.log(`After crash at 3.00x (Bet 2 lost): Balance: $${r3Host.balance.toFixed(2)} | Active Wagers: ${r3Host.activeWagers.size}`);
assert.strictEqual(r3Host.balance, 1225.00, 'Balance remains $1,225.00 ($1250 - $75 + $50)');
assert.strictEqual(r3Host.activeWagers.size, 0, 'Active wagers must be 0');

console.log('\n--- TEST 8: Cashout vs Crash Race Condition Determinism ---');
// Scenario A: Cashout occurs before crash (accepted -> CASHED_OUT)
const r4 = 'round_1045';
const raceHost = new MockBetadrixHost(1250.00);
raceHost.handleBetRequest({ requestId: `${r4}_slot1_req`, roundId: r4, slotId: 'slot1', amount: 50 });
// Pre-crash cashout
const earlyCashout = raceHost.handleResult({
  requestId: `${r4}_slot1_req`,
  roundId: r4,
  slotId: 'slot1',
  outcome: 'CASHOUT',
  multiplier: 1.80,
});
assert.strictEqual(earlyCashout.settled, true, 'Early cashout must settle');
assert.strictEqual(earlyCashout.payout, 90.00, 'Payout must be $90.00');
// Settle round crash after
raceHost.recordRoundEnd(r4, 2.50);
assert.strictEqual(raceHost.balance, 1290.00, 'Balance must be $1,290.00');
assert.strictEqual(raceHost.activeWagers.size, 0, 'Active wagers must be 0');

// Scenario B: Crash occurs before cashout (cashout arrives after crash settlement -> REJECTED, status is LOST)
const r5 = 'round_1046';
raceHost.handleBetRequest({ requestId: `${r5}_slot1_req`, roundId: r5, slotId: 'slot1', amount: 50 });
// Authoritative crash first
raceHost.recordRoundEnd(r5, 1.20); // settles r5 as crash -> LOST
// Late cashout attempt arrives
const lateCashout = raceHost.handleResult({
  requestId: `${r5}_slot1_req`,
  roundId: r5,
  slotId: 'slot1',
  outcome: 'CASHOUT',
  multiplier: 1.50,
});
console.log(`Late cashout after crash settled? ${lateCashout.settled} (Expected: false)`);
assert.strictEqual(lateCashout.settled, false, 'Late cashout after crash MUST be rejected');
assert.strictEqual(raceHost.balance, 1240.00, 'Balance reflects only the $50 loss (1290 - 50 = 1240)');
assert.strictEqual(raceHost.activeWagers.size, 0, 'Active wagers must remain 0');

console.log('\n--- TEST 9: Duplicate Settlement and Message Replay Immunity ---');
const replaySettlement = raceHost.handleResult({
  requestId: `${r5}_slot1_req`,
  roundId: r5,
  slotId: 'slot1',
  outcome: 'CRASH',
  multiplier: 1.20,
});
assert.strictEqual(replaySettlement.settled, false, 'Replayed settlement must be rejected');
assert.strictEqual(raceHost.balance, 1240.00, 'Balance must not change on duplicate settlement');

console.log('\n====================================================');
console.log('ALL ASSERTIONS (TESTS 1 - 9) PASSED WITH 100% MATHEMATICAL PRECISION!');
console.log('====================================================');

