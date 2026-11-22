# 13 Roadmap and backlog

A prioritized list a developer can pick up. Each item says why it matters, where in the code it lands, and how to know it is done. Effort: S (under a day), M (1 to 3 days), L (a week or more).

## Done in revision 4

Ask Ava (the front door), autonomy for routine messages, the supplier view, "What this reached", live sync across windows, the own-time north star, deterministic sample files. See [18 Ask Ava](18-ask-ava.md) and ADRs 0011 to 0013.

## Guided demo follow-ups

| # | Item | Why | Where | Done when | Effort |
|---|---|---|---|---|---|
| D1 | Use `Term` on the request page, Today and the AI labels | Jargon (Decision Receipt, Critical path, Cached, Reconfirm) is still unexplained where people meet it | `request.tsx`, `ai.tsx`, `app/today` | Each term on those pages defines itself | S |
| D2 | Count how far reviewers get | Know whether the orientation, the steps and the debrief land | Send `tour_done`, `step_n`, `debrief_open`, `task_done` to the analytics tool chosen in X2 | Funnel from landing to debrief | S |
| D3 | Role-based first run | A budget owner should learn Approvals first, Legal the packet | `lib/guide.ts` page help and tasks keyed by `viewAs` | Switching to Vikram offers "Approve a receipt" | M |
| D4 | Coach marks for the request page itself, outside the demo | Someone who lands on a request from a link gets no tour | New stops in `UiTour` keyed to page | "Replay tips for this page" in Help | M |

## Now: make the AI real and measurable

| # | Item | Why | Where | Done when | Effort |
|---|---|---|---|---|---|
| N1 | Add `ANTHROPIC_API_KEY` on Vercel and redeploy | Live AI is built but has never run | Vercel settings | `GET /api/ava` returns `ai: true`; a composed email shows Live AI read, plan and recommendations | S |
| N2 | Script to regenerate cached reads, plans and recommendations from the model | `lib/aiScript.ts` was written by hand | New `scripts/build-ai-cache.ts`: replay the story, at each cached `ai` event call `runLayer` with `requestContext`, write JSON to `data/ai-cache/`, have `lib/aiScript.ts` import it | `npm run build-ai-cache && npm run eval` passes; diff reviewed | M |
| N3 | Model-graded faithfulness eval | Rule evals cannot judge whether a sentence is true to its cited quote | `lib/evals.ts` + a new eval that asks a second model "Does the quote support the sentence? yes/no/partly" | Score per output in `npm run eval -- --graded`; threshold in CI | M |
| N4 | CI on pull requests | Keep engine, evals and build green | `.github/workflows/ci.yml` running `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run eval`, `npm run build` | Required check on `main` | S |
| N5 | Prompt versioning | Know which prompt produced which output | Add `promptVersion` to `ai` events and `Versioned`; constant in `lib/aiLayers.ts` | Shown in the tooltip of the AI label; evals grouped by version | S |
| N6 | Recommendation outcome analytics | Learn which advice people trust | Aggregate `rec_use` / `rec_dismiss` (with reasons) per type and confidence | Dashboard card "Ava's advice: used 8, edited 2, dismissed 1" | S |
| N7 | Prediction accuracy | Plans predict dates; measure them | Use `predictionHit` across requests, plus misses | Dashboard "Predictions: 3 of 4 within a day" | S |

## Next: product depth

| # | Item | Why | Where | Done when | Effort |
|---|---|---|---|---|---|
| X1 | Real mail ingestion | The mailbox is simulated | New `/api/inbound` receiving Microsoft Graph or Gmail push; map to `Email`; run extraction server-side | A mail rule copy creates an `email` event | L |
| X2 | Server persistence and multi-user | State lives in one browser | Move the event log to a database (Postgres or Vercel KV); keep `replay` | Two browsers see the same requests; events append-only | L |
| X3 | Auth and roles | View as is a demo device | Sign-in; map users to `PEOPLE`; enforce who can approve | Only the named approver can approve | M |
| X4 | Merge, split and refile requests | Filing can be wrong | New actions `merge_requests`, `move_email`; UI on the request header | Moving an email re-folds facts and re-runs rules | M |
| X5 | More commitment checks | Only rates, delivery, renewal, insurance and DPA are checked | `checkCommitments`: payment terms (MSA 6), key personnel (7.1, TB 5.1), liability cap (10), termination notice (13) | Each with a unit test and a clause-backed conflict | M per check |
| X6 | Clause extraction from uploaded contracts | Contracts are hand-entered in `data/contracts.json` | An AI layer that turns a contract PDF into clauses with kinds and dues, reviewed by Legal before use | Upload an MSA, see Commitments filled, Legal approves | L |
| X7 | Notifications and digests | People need to know without opening the app. Highest-value next step after X2: an approver should be able to approve from the message | Email or Slack digest from `deriveItems` per person, with a signed one-click link to the Decision Receipt | Daily "Today" digest; approving from the message writes the same `approve` event | M |
| X8 | Live re-planning on new info | Plans refresh only when facts change | Trigger re-plan on approvals and supplier replies too (extend `fingerprint`) | Plan "What changed" after each approval | S |
| X9 | Supplier portal reply parsing | Suppliers reply in threads with quotes | Strip quoted history before extraction | Quoted lines never become facts | S |

## Later: scale and polish

| # | Item | Why | Effort |
|---|---|---|---|
| L1 | Make background requests real engine requests (seed events) instead of static JSON | One source of truth; actions work on them | M |
| L2 | Handoff to Sirion or another CLM via API with the packet JSON | The packet is designed as the contract system's input | M |
| L3 | Multi-currency and GST variants | Indian-only assumptions | M |
| L4 | Accessibility audit (axe in CI, screen-reader pass on the conflict card and plan) | Prototype follows basics only | S |
| L5 | Internationalised copy file | Copy is inline in components | M |
| L6 | Performance: memoise `deriveItems` and `analyze` across renders for 200+ requests | WeakMap caches are per state | M |

## Design backlog

See [14 Design system](14-design-system.md) "Known design debt".

## How to propose an item

Open an issue with the feature template (`.github/ISSUE_TEMPLATE/feature.md`): problem, who it helps, the metric it moves, where in the code, acceptance checks.
