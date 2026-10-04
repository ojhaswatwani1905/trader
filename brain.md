# Trader Game — Technical Architecture & Knowledge Document (`brain.md`)

## 1. Project Overview & Scope
Trader is an original, demo-only crash-style market multiplier game. It replicates the adrenaline and mechanics of fluctuating market charts (rise, micro-dips, surges, and crash points) while maintaining strict architectural boundaries:
- **No external provider dependencies**: Self-contained Next.js implementation with no Spribe/third-party game iframes or code.
- **Pure virtual demo**: Simulated credits only, no real-money or cryptocurrency claims.
- **Authoritative Host Wallet Model**: Fully ready for BETADRiX embedding without local wallet bleed or state pollution.

---

## 2. Core Architecture & Modules

```
src/
├── app/
│   ├── layout.tsx         # Global fonts, metadata, and dark theme
│   ├── page.tsx           # Standalone route (/)
│   └── embed/
│       └── page.tsx       # Dedicated embed route (/embed)
├── components/
│   ├── BetControls.tsx    # Wager input, presets ($1-$100), dynamic CTA
│   ├── HistoryBar.tsx     # Past multipliers ribbon with color tiers
│   ├── SimulatedFeed.tsx  # Demo participants ticker
│   ├── TraderCanvas.tsx   # 60fps HTML5 Canvas market chart with glow
│   ├── TraderGame.tsx     # Unified game viewport orchestrator
│   └── TraderHeader.tsx   # Authoritative balance, brand, sound toggle
├── hooks/
│   └── useTraderGame.ts   # Core engine: state machine, postMessage, loop
├── lib/
│   ├── marketSimulation.ts# Mathematical fluctuation curves & crash generator
│   ├── security.ts        # Origin validator & targetOrigin resolver
│   └── sound.ts           # Zero-asset Web Audio API synthesizer
└── types/
    └── trader.ts          # Strongly typed protocol messages & states
```

---

## 3. Authoritative Wallet vs Standalone Wallet Isolation

| Property | Standalone Mode (`/`) | Embedded Mode (`/embed`) |
| :--- | :--- | :--- |
| **Parent Window** | `window.parent === window` | `window.parent !== window` |
| **Initial Wallet State** | `$1,250.00` | Locked in `CONNECTING` (0 balance displayed) |
| **Source of Truth** | Local state & `localStorage` | Parent window (BETADRiX host) |
| **Balance Persistence** | `trader_standalone_balance` | **NEVER** persisted to disk / `localStorage` |
| **Deduction & Credit** | Calculated and deducted locally | Performed **exclusively** by BETADRiX via `postMessage` |
| **Reset Capability** | `RESET` button visible & active | `RESET` button hidden & disabled |
| **Round Initiation** | Immediate on Place Bet | Only starts upon receiving `BETADRiX_BET_ACCEPTED` |

---

## 4. PostMessage Protocol Implementation

### Outbound from Trader:
1. `TRADER_READY`: Sent immediately on mount, and periodically every 1s until `BETADRiX_TRADER_INIT` is acknowledged.
2. `TRADER_BET_REQUEST`: `{ requestId, amount }`. Initiates the wager lock.
3. `TRADER_CASHOUT_REQUEST`: `{ requestId, multiplier }`. Notifies host of user cashout action.
4. `TRADER_RESULT`: `{ requestId, outcome: 'CASHOUT' | 'CRASH', multiplier }`. Emitted once per round.

### Inbound to Trader:
1. `BETADRiX_TRADER_INIT`: `{ balance, currency }`. Establishes the authoritative wallet baseline.
2. `BETADRiX_BET_ACCEPTED`: `{ requestId, amount, balance }`. Confirms authoritative deduction; round begins.
3. `BETADRiX_BET_REJECTED`: `{ requestId, reason }`. Handles insufficient funds or host rejection.
4. `BETADRiX_RESULT_SETTLED`: `{ requestId, betAmount, payout, balance }`. Host authoritative balance update after round conclusion.
5. `BETADRiX_BALANCE_UPDATE`: `{ balance }`. External balance refresh.

---

## 5. State Machine & Atomic Race Condition Protection

### State Lifecycle:
`IDLE` → `CONNECTING` → `READY` → `BET_PENDING` → `ROUND_STARTING` → `LIVE` → `CASHOUT_PENDING` → `CASHED_OUT` → `SETTLED` (or `LIVE` → `CRASHED` → `SETTLED`).

### Atomic Cashout vs Crash Resolution:
```typescript
// Cashout execution
if (stateRef.current !== 'LIVE') return;
stateRef.current = 'CASHOUT_PENDING'; // Synchronously locked

// Market crash execution in animation loop
if (stateRef.current !== 'LIVE') return;
stateRef.current = 'CRASHED'; // Synchronously locked
```
Because JavaScript execution within a single thread is non-preemptive for synchronous statements, assigning `stateRef.current` guarantees that whichever event triggers first (cashout click vs crash tick) claims the round. The other is immediately discarded.

---

## 6. Duplicate Transaction & Replay Protection

To avoid the duplicate settlement bugs previously seen in other embedded integrations:
1. **Request Tracking Sets**:
   - `pendingRequests`: Registered on bet click; removed on acceptance/rejection.
   - `activeRounds`: Registered on `BETADRiX_BET_ACCEPTED`; removed on settlement.
   - `settledRequests`: Registered on `BETADRiX_RESULT_SETTLED`.
2. **Replay Rejection**:
   - If a duplicate `BETADRiX_RESULT_SETTLED` message arrives with an already-settled `requestId`, it is ignored.
   - If an unauthorized `BETADRiX_BET_ACCEPTED` arrives with a mismatched or non-pending `requestId`, it is rejected.

---

## 7. Origin Security Matrix

Allowed Origins:
- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `http://localhost:3001` / `127.0.0.1:3001`
- `https://demo-m4tn.onrender.com`
- Dynamic environment origin `NEXT_PUBLIC_BETADRIX_ORIGIN`
- Same-origin fallback for iframe test harnesses

All postMessages sent to the host use `getSafeTargetOrigin()` and never broadcast with `'*'` in production.

---

## 8. Web Audio API Synthesizer

The sound system avoids external `.mp3` or `.wav` dependencies by utilizing the native Web Audio API:
- `playClick`: Quick sine beep (800Hz → 400Hz).
- `playBetAccepted`: Dual-tone triangle chime (440Hz + 660Hz).
- `playTick`: Dynamic frequency sine wave that scales upward as multiplier increases.
- `playCashout`: Ascending arpeggio (C5 - E5 - G5 - C6).
- `playCrash`: Low sawtooth bass breaker drop (160Hz → 35Hz).
- Persistent mute toggle with local storage memory.
