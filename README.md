# BETADRiX Trader — Original Crash Game Simulation

An original, high-performance market multiplier crash game simulation designed specifically for the BETADRiX gaming platform. Built with Next.js (App Router), TypeScript, and Tailwind CSS.

> **CRITICAL DEMO NOTICE**: This is an educational demonstration and simulation game using simulated virtual credits only. There is no real money, deposit, withdrawal, banking, or cryptocurrency integration. Not provably fair, not an audited casino provider, and not real financial market data.

---

## 1. System Architecture

Trader is architected with dual-mode operational isolation:

```
┌──────────────────────────────────────────────────────────────┐
│                       BETADRiX HOST                          │
│                (Authoritative Wallet Owner)                  │
└──────────────────────────────┬───────────────────────────────┘
                               │
               postMessage     │ window.parent.postMessage
             Origin-Restricted │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     TRADER IFRAME (/embed)                   │
│                                                              │
│  State Machine: READY → BET_PENDING → LIVE → CASHED_OUT      │
│  Simulation Engine: Fluctuation curves & deterministic crash │
│  Canvas: 60fps requestAnimationFrame market chart            │
│  NO LOCAL WALLET — STRICT SLAVE TO HOST                      │
└──────────────────────────────────────────────────────────────┘
```

### Route Structure:
- `/` — **Standalone Mode**: Development and test screen with local demo wallet ($1,250.00), reset button, sound controls, and full UI.
- `/embed` — **Embedded Mode**: Clean, iframe-optimized game viewport specifically designed for BETADRiX integration. Stripped of all outer navigation chrome, headers, and footers.

---

## 2. Wallet Ownership & Mode Isolation

### Embedded Mode (`window.parent !== window` or `/embed`):
- **BETADRiX is the sole authoritative wallet owner.**
- Trader does NOT maintain an independent balance, does NOT deduct or credit balances locally, and NEVER writes wallet state to `localStorage`.
- Betting controls remain locked in `CONNECTING` state until `BETADRiX_TRADER_INIT` is received from the parent host.
- A round can **only** start after `BETADRiX_BET_ACCEPTED` is received from the parent host.

### Standalone Mode (`window.parent === window` and `/`):
- Local simulated demo balance initialized to `$1,250.00`.
- Stored under `trader_standalone_balance` in browser `localStorage`.
- Includes a dedicated `RESET` button to restore the $1,250.00 balance anytime.
- Completely isolated from embedded mode.

---

## 3. PostMessage Protocol

Strict message types and schemas:

| Direction | Message Type | Payload Structure | Description |
|-----------|--------------|-------------------|-------------|
| Trader → Host | `TRADER_READY` | `{ type: "TRADER_READY" }` | Emitted when iframe loads to establish connection handshake. |
| Host → Trader | `BETADRiX_TRADER_INIT` | `{ type: "BETADRiX_TRADER_INIT", balance: number, currency: "USD" }` | Authoritative wallet initialization; unlocks controls. |
| Trader → Host | `TRADER_BET_REQUEST` | `{ type: "TRADER_BET_REQUEST", requestId: string, amount: number }` | Asks host to validate and deduct wager. |
| Host → Trader | `BETADRiX_BET_ACCEPTED` | `{ type: "BETADRiX_BET_ACCEPTED", requestId: string, amount: number, balance: number }` | Host confirms deduction and returns updated balance. Round begins. |
| Host → Trader | `BETADRiX_BET_REJECTED` | `{ type: "BETADRiX_BET_REJECTED", requestId: string, reason: string }` | Host rejects bet (e.g. `INSUFFICIENT_BALANCE`). |
| Trader → Host | `TRADER_CASHOUT_REQUEST` | `{ type: "TRADER_CASHOUT_REQUEST", requestId: string, multiplier: number }` | Signals player cashed out at indicated multiplier. |
| Trader → Host | `TRADER_RESULT` | `{ type: "TRADER_RESULT", requestId: string, outcome: "CASHOUT" \| "CRASH", multiplier: number }` | Final round outcome emitted once per round. |
| Host → Trader | `BETADRiX_RESULT_SETTLED` | `{ type: "BETADRiX_RESULT_SETTLED", requestId: string, betAmount: number, payout: number, balance: number }` | Host confirms authoritative payout and updated balance. |
| Host → Trader | `BETADRiX_BALANCE_UPDATE` | `{ type: "BETADRiX_BALANCE_UPDATE", balance: number }` | Host pushes external wallet update (e.g. bonus, deposit). |

---

## 4. Round State Machine

```
   [CONNECTING] (embed only)
         │
         ▼ (BETADRiX_TRADER_INIT)
      [READY] ◄────────────────────────────────────────┐
         │                                             │
         ▼ (User clicks Place Bet)                     │
   [BET_PENDING]                                       │
         │                                             │
         ├───────────► (BETADRiX_BET_REJECTED) ────────┤
         │                                             │
         ▼ (BETADRiX_BET_ACCEPTED)                     │
  [ROUND_STARTING]                                     │
         │                                             │
         ▼ (Warm-up complete)                          │
       [LIVE] ─────────────────────────┐               │
         │                             │ (Crash point  │
         │ (User clicks Cash Out)      │  reached)     │
         ▼                             ▼               │
  [CASHOUT_PENDING]                 [CRASHED]          │
         │                             │               │
         ▼ (TRADER_RESULT sent)        │               │
    [CASHED_OUT]                       │               │
         │                             │               │
         └──────────────┬──────────────┘               │
                        ▼ (BETADRiX_RESULT_SETTLED)    │
                    [SETTLED]                          │
                        │                              │
                        └────────── Cooldown ──────────┘
```

---

## 5. Cashout vs Crash Race Condition Protection

In high-volatility crash games, a player may click `CASH OUT` at the exact millisecond the chart crashes:
- A synchronous `stateRef.current` lock is enforced.
- When `cashOut()` executes, it immediately tests `if (stateRef.current !== 'LIVE') return;` and atomically transitions `stateRef.current = 'CASHOUT_PENDING'`.
- The animation loop checks `if (stateRef.current !== 'LIVE') return;` prior to triggering a crash.
- Whichever authoritative event executes first wins atomically. A single wager can never be settled as both a win and a loss.

---

## 6. Transaction Safety & Deduplication

- Every wager generates a cryptographically collision-safe ID: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`.
- The engine maintains internal memory sets:
  - `pendingRequests`: Bet requests awaiting acceptance.
  - `activeRounds`: Rounds currently live.
  - `settledRequests`: Rounds that have been finalized.
- Guarantees:
  - Every wager is deducted exactly once.
  - Every settlement is credited exactly once.
  - Double clicks, replay attacks, or stale messages are discarded.

---

## 7. Origin Security

- Strict validation on all incoming `message` events against authorized BETADRiX host domains:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
  - `https://demo-m4tn.onrender.com`
  - Configurable `NEXT_PUBLIC_BETADRIX_ORIGIN`
- Outbound postMessages are targeted explicitly to the verified parent origin. No wildcards (`*`) in production.

---

## 8. Test Harness

A full BETADRiX parent host simulator is provided at:
- `test-embed.html` (root)
- `public/test-embed.html` (accessible via browser at `/test-embed.html`)

Features:
- Embeds `/embed` in a live iframe.
- Authoritative mock wallet ($1,250.00).
- Real-time postMessage traffic monitor with JSON viewer.
- Edge case buttons: replay duplicate accept, replay duplicate settle, test stale request, simulate insufficient balance, and test latency.

---

## 9. Development & Deployment

### Run Locally:
```bash
npm install
npm run dev
```

### Access:
- Standalone Game: `http://localhost:3000/`
- Embedded Game: `http://localhost:3000/embed`
- BETADRiX Simulator: `http://localhost:3000/test-embed.html`

### Type Check & Build:
```bash
npx tsc --noEmit
npm run build
```
