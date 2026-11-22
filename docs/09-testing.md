# 09 Testing

## Engine tests (`npm test`)

Vitest: `tests/engine.test.ts` (25 tests) and `tests/evals.test.ts` (3 tests), all passing. See [17 AI evals](17-ai-evals.md) for `npm run eval`. They run the real story events through `applyEvent` without a browser.

| Group | Test | Asserts |
|---|---|---|
| Pure functions | computeCumulativeSpend | ₹9L + ₹9L + ₹20L = ₹38L, over the limit |
| | computeCumulativeSpend window | Excludes contracts older than 90 days and other cost centres |
| | computeRouting | Budget, VP and InfoSec with confirmed data access; Legal end state |
| | applySupersession | New value wins; the old version is kept |
| | approvalStatus | Reopens on an increase: given for ₹20L, current ₹21.5L |
| | computeHandoffState | Blocks on stale approvals with the right banner |
| Scenario A | Steps 1–2 | REQ-1047, ₹38L, VP and competing quote, start date 4 days away |
| | Step 3 | Amount confirmed by document; data access question; rate conflict impact ₹39,200, type against_contract; Architect consistent; delivery conflict ₹90,000, "2 business days … 10 required", "35 days late" |
| | Step 4 | Each department's items (InfoSec, budget, VP, Procurement, Legal); NDA done; certificate waiting; expiry flag "8 Dec 2026, in 3 weeks" |
| | Steps 6–7 | ₹21.5L, ₹39.5L, exactly two approvals reopen, handoff blocked |
| | Step 9 | Ready for Legal Review |
| | New input | A ₹23L quote on the thread: ₹41L, a conflict, reopened approvals |
| Contrast and B | Repeat request | ₹6L, budget owner only, Ready to issue PO after Ritu |
| | Scenario B | REQ-1063; renewal conflict with three lines; Ava's draft counters at 5% for 12 months; KA-7781 linked; conflict closes on the revised form; ₹21.3L Ready to issue PO; Finance started-before-approval 1 |
| Timing and sources | Timing | 3 business days; InfoSec longest wait Thu 12 Nov 12:05 to Tue 17 Nov 11:05 |
| | Basic extractor A | Same outcomes with no cache: ₹38L, ₹39.5L, two reopen, Ready for Legal Review |
| | Basic extractor B | ₹21.3L, Ready to issue PO |
| Waits and withdrawals | Scenario B longest wait | Kosha's corrected order form (Mon 23 Nov 10:20 to Tue 1 Dec 14:30) |
| | Withdrawal | A ₹23L quote after Ready withdraws the handoff ("₹21.11L → ₹23L") and tells Farah |
| Revision 3 | Step 8 | Receipts at ₹21,10,800 and ₹39,10,800; rate conflict resolved; ₹90,000 contract issue recorded |
| | Decrease rule | ₹21.5L/₹39.5L approved, then ₹21,10,800/₹39,10,800 stays Approved |
| | Step 9 | Ready; "Predicted on Thu 11:40: Tue 17 Nov. Actual: Tue 17 Nov 11:05."; more than 20 Ava actions; 8 to 14 decisions |
| | Step 7 | What changed includes "Budget approval reopened" and "Handoff blocked" |
| | Plan validation | Missing policy steps inserted ("Added by policy check"); unknown owner reassigned to Karan; circular dependency removed |
| | Scenario B | "5% increase: within the 7% cap" |

## Browser walk-throughs

Playwright (Python, system Chrome) against `next start`, run during the build:

- Fresh session: Dashboard, Today, Conflicts, Requests, a background request, the Trivenika supplier page, Captured mail. Screenshots checked by eye. No page errors.
- Scenario A through the dock: A1, A3, A6 (viewer v1 beside v2 with the new line), A7, A9 (green banner with counts and prediction, handoff packet). No page errors.
- Landing screenshots (`public/screens/reads.png`, `plans.png`, `acts.png`, `advises.png`) captured from the running app at A4, A6 and A9.

## Revision 3 acceptance checks (Part 8)

| Check | Status |
|---|---|
| Request page order: read (cited), Needs you, plan, Problems with Ava recommends, contract card, Ava did | Built; seen in screenshots |
| Plans show policy vs Ava badges; a removed policy step is restored and logged | Built; unit test |
| Step 3: ₹90,000 and 2 vs 10 days; ₹39,200 with per-line amounts and Architect tick; predicted date Tue 17 Nov with certificate history | Unit tests and screenshot |
| Step 6: UAT recommendation, medium confidence, one-click question to Rahul | Built; screenshot |
| Step 7: What changed in the plan | Unit test |
| Step 8: ₹21,10,800 and ₹39,10,800; a decrease never reopens | Unit tests |
| Step 9: computed banner; prediction line | Unit test and screenshot |
| Scenario B: 7% cap, late notice and auto-renewal lines; recommendation with draft; 5% tick; ₹1,26,000 saved a year | Built; 5% tick unit-tested; the saving is computed in `lib/insights.ts` (not unit-tested) |
| Fresh session: At risk ≥ 2, Ava caught this ≥ 3, counters > 0 except Forms filled | Seen on the dashboard screenshot (2 at risk, 4 caught, ₹11.5L, 100 : 11, 32) |
| Conflicts list shows REQ-1029, 1034, 1040, 1041 | Built |
| Today has all three sections for every person | Background data covers each of the 10 View-as people; checked for Karan by screenshot |
| Every contract opens as a PDF; clause links open at the clause | Built |
| Live and fallback for a composed ₹23L email | Fallback path works; live path not run (no key) |
| No "Inbox" anywhere; composer button "Simulate email arriving"; Test lab separate | Checked by grep and screenshot |
| Part 6 fixes; no banned words; citations on all AI output | Banned-word scan clean; zod requires a citation per read sentence |

## Commands

```bash
npm test                 # engine tests
npx tsc --noEmit         # type check
npm run build            # samples + production build
npx next start -p 3100   # then run Playwright scripts against it
```
