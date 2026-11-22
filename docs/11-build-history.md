# 11 Build history

Everything done in this build, in order. Dates are 21 and 22 Nov 2026 (IST).

## Inputs

- `ava-prototype-build-prompt.md`: the build spec (one engine, fictional world, 11 policy rules, Scenario A in 9 steps, contrast request, Scenario B, screens, AI contract, design and writing rules, acceptance checklist, story tab content).
- `ISB_Assignment_Sirion.pdf`: the case study.
- Revision prompt 2 (P0, P1, P2 fixes).
- Revision prompt 3: "Make Ava visibly AI-powered" (Parts 0 to 8).

## Commit log

| Commit | What |
|---|---|
| `7f5d73e` | **Initial prototype.** Next.js app with a single event-sourced engine: supplier email and attachments become structured, routed requests. Scenario A, Scenario B, the repeat-request contrast, compose-any-email, story tabs, engine tests. Pushed to GitHub; Vercel project created and connected (the user approved team access). |
| `5d341d4` | **Redesign** (design-floor skill, first-principles review). App shell with a left sidebar (icons, live counts), persona switcher, top bar with simulated clock and notifications. Guided demo moved to a two-row dock. Overview page with the five-stage flow. Request page with an intake stepper, one status banner, tabs. OKLCH tokens, Inter and IBM Plex Mono, reflow to 320 px. |
| `a921130` | **Six case pages rebuilt** around what each must prove: question and one-line answer first, then evidence in the form that fits (lifecycle strip, stat cards, spectrum, north-star formula with a live value, assumption table, comparison matrix). Demo references are buttons that replay the engine. |
| `283b998` | **Revision 2.** P0: AI label; "What changed" banner first in the recorded panel; guided steps scroll to and pulse what changed; A6 opens v1 beside v2; B1 highlights the three order-form lines; B4 shows v1 beside v2; 5-column dashboard with 16 background requests; display names, human ages, supplier waits attributed to the supplier, Legal sees withdrawn packets. P1: landing cut to essentials with four screenshot tabs; sidebar simplified; View as in the top bar with "Now acting as"; one summary sentence on the request page; routing drawer; Outlook view; "How Ava connects" diagram. P2: one date format, icon rail at tablet width, reset message. |
| `b150b08` | **Revision 3: Ava visibly AI-powered.** See below. |
| `9150636` | Documentation (`README.md`, `docs/01`–`11`). |
| `3033a7a` | AI output evals (`lib/evals.ts`, `npm run eval`), live-output guardrail and badge, AI context carries the VP limit and renewal saving, product spec. |
| `7793322`–later | Roadmap, design system, developer guide, API reference, evals guide, ADRs, CI, issue and PR templates, `.env.example`, CONTRIBUTING, glossary. |
| `42a9137` | **Status line fix** (branch `design-floor-pass`, PR #2). `conflictShort` named only three of the five conflict types, so the summary called rate-cap and late-delivery conflicts "data access not confirmed". Contract conflicts now use their own title. Test added. |
| `6b97d2e` | **Design floor pass** (branch `design-floor-pass`, PR #2). Landing: Watch buttons in the hero, dock hidden until a demo starts, full-width screenshots, arrow-key tabs, honest stats labels. Request page: header sticks only from tablet width, "On this page" jump list, Needs you links to the conflict card instead of repeating the recommendation, long log lines wrap. Phone dock: caption above buttons. Checked at 320, 375, 768 and 1280 px. |
| branch `demo-guided-experience` | **Guided demo and in-product guidance.** Demo bar with outline and keyboard; coach card per step (what to notice, why it matters, who acted, who was reached) with a steady ring and a "Look here" pin; first-run orientation; debrief with the scenario's numbers; Help menu with "Try it yourself"; page tips; glossary `Term`. See [20](20-guided-demo.md). 13 new tests (55 in all). |
| uncommitted | **Ask Ava, autonomy, own time, ripple, supplier view.** See below and [18](18-ask-ava.md). |

## Revision 3 in detail

| Part | Done |
|---|---|
| 0 Prerequisites | Code works without a key. Writing rules applied; banned-word scan clean. The key is still to be added on Vercel. |
| 1 Contracts | `data/contracts.json` with every clause and number from the brief; PDFs generated with numbered clauses; supplier history; clause links open the PDF at the clause; supplier Commitments list. Added PW-ORD-2025 so the Pixelwise conflict has a clause. |
| 2 Contract checks | `checkCommitments` after the fact diff; ticks and "Goes against the contract" cards; consequences computed by code; actions Accept with a reason, Ask the supplier, Ask Legal, Require a change request, Comment, Re-run Ava, Escalate; every check logged once as an Ava action. |
| 3 AI layers | Ava's read (versioned, fingerprinted, "see previous"); Ava's plan (validated by code, What changed, prediction and hit line); Ava did and decisions counted from the log; Today home; Ava recommends with Use this, Edit, Dismiss with a reason, all logged as human decisions; dashboard At risk. |
| 4 Screens | Sidebar renamed; request page reordered as a case file; Captured mail panel reordered with contract checks; Test lab button in the dock and the page; composer "Simulate email arriving" with the mail-rule note; Today; dashboard order and counters; landing subhead and four AI verbs with new screenshots. |
| 5 Scenario scripts | A3 body sentence; A4 Karan sends the rate draft at 12:20; A5 receipt summaries; A6 UAT recommendation; A7 one-click question and Rahul's answer at 10:30; A8 new email `e-a6` (v3 and RateCard v2) at 10:40, reconfirmations, exception, change request; A9 prediction line and packet contents; B1 to B5 reads, plans and recommendations; background reads, plans, conflicts (REQ-1029, 1034, 1040, 1041) and risks (REQ-1029, 1032). |
| 6 Fixes | Background conflicts in Conflicts and dashboard; REQ-1035 Ready for Legal Review; background 90-day totals computed; named budget owners; "opened … ago"; display names instead of supplier ids. |
| 7 AI calls | `/api/ava/extract`, `/read`, `/plan`, `/recommend` with zod, one retry and fallbacks; shared system prompt rules; labels Live AI, Cached, Summary from rules. |
| 8 Acceptance | 6 new tests (25 total), browser walk-through, screenshots. See [09](09-testing.md). |

## Design decisions

- **One engine, event-sourced.** Scripted steps, composed mail and clicks share `applyEvent`, so the demo cannot drift from the product, and counts come from the log.
- **AI outputs are events too.** Reads, plans and recommendations are stored as `ai` events, so they replay, version and log like everything else, and a live answer slots in the same way as a cached one.
- **Fingerprints decide staleness.** An AI output is shown only while the facts it was written for are unchanged; otherwise the rules fallback shows, labelled, and the live hook asks again.
- **Code owns numbers.** The AI never computes money or dates; plans are validated and statuses come from the engine.
- **Stable conflict ids.** The rate conflict is keyed by the MSA, and the price conflict by the approval count, so a new quote updates the open card instead of closing and reopening it.
- **Decrease rule.** Only increases in amount, 90-day total or early-start amount reopen approvals.
- **Background data is static but complete.** It fills the dashboard and Today from the first load and is clearly labelled, but never changes the scenario numbers.

## Ask Ava, autonomy and own time (PR #3)

| Area | Done |
|---|---|
| Ask Ava | `/new` and `lib/intake.ts`: plain-language need → editable fields → preview with the real engine on a copy of the state → request opened before any supplier email (`origin: "intake"`, `ingestIntake`, shared `openRequest`). Duplicate requests become a note on the open one. Three examples. |
| Autonomy | `state.autonomy` and `set_autonomy`; Settings shows the ladder and two switches. Quote requests from Ask Ava are sent by Ava by default (`sendDraft`, `autoSent`); document chasers stay drafts by default. ADR 0011 supersedes the "Ava never sends" part of ADR 0005. |
| North star | Redefined on Prayaan's own time (`waitSplit`, `northStar`, `timeLine`); dashboard counters, timing card, handoff banner and the Metrics case page (where the time goes, drivers, week-1 baseline, new tripwires) use it. ADR 0012. |
| Ripple and windows | "What this reached" after every change (`rippleBetween`); the event log is shared across the browser's windows and followed live; "View as" is per window. ADR 0013. |
| Supplier view | `/supplier/[id]`: what the supplier sees, and replies (note, upload or sample) that arrive as email on the same thread. |
| Small UI | Dock starts as a pill on phones; finished plan steps fold away after two. |
| Landing | Subhead and an Ask Ava link; trust line says Ava sends only the routine messages you switch on; a returning visitor mid-demo is told where they left off and can resume or start clean. |
| Fallback plan | The rules-only plan always shows "Get <supplier>'s written quote" (until a quote, order form or SOW is on file) and the handoff step. |
| Samples | `make-samples.ts` writes PDFs with fixed dates and no update metadata, so regenerating gives identical files. |
| Tests | `tests/intake.test.ts` (10) and `tests/metrics.test.ts` (3); 42 in all. |

## Local setup notes (22 Nov 2026)

- The working copy was cloned next to an older, un-versioned copy of the project in the parent folder (roughly the first commit). Next.js warns about that copy's `package-lock.json`; it is harmless.
- The Mac had no Node.js and no Homebrew. Node 22.23.5 was installed from the official nodejs.org tarball into `~/.local/node`, checked against `SHASUMS256.txt`. The dev server is started through a shell that puts it on `PATH`, because Next.js starts a separate `node` process for PostCSS.
- On a fresh clone `npm test` used to fail until `npm run samples` had run once, because the committed `sample-texts.json` was stale. PR #4 fixed that: a clean clone now passes all 42 tests with `npm ci` and `npm test`.
- Pushing uses the GitHub CLI 2.105.0 (`~/.local/gh`, checked against its published checksums), signed in with `gh auth login --web` through Google.

## Bugs found and fixed along the way

- Next.js page files may only default-export: shared helpers moved to `lib/summary.ts`.
- Tailwind's built-in `pulse` keyframes collided with ours: renamed to `ava-pulse`.
- The Kosha banner read "2027" as an amount: term and months are checked before ₹ amounts.
- A billing invoice was counted as the supplier's reply: supplier waits now count same-thread replies only.
- Playwright clipped screenshots outside the viewport: scroll to top or screenshot elements.
- `ai` missing from the initial state and the event union typing in `applyEvent`.
- The rate conflict re-opened under a new id for each quote: id made stable.
- The said-vs-written conflict closed with the wrong text when v3 arrived: id keyed by approval count.
- Plan diff missed "reopened" when the previous status was not "done", and reported "Handoff blocked" when it was not new.
- The contract card showed a green tick for clauses that had been broken but were later handled: now "Raised, handled".
- Background summaries did not match the project names on the pipeline: rewritten.
- `git commit -c` is not a commit option: identity is passed as `git -c user.name=… commit`.
- The request status line named every non-data conflict "data access not confirmed" (fixed in `42a9137`).
- "Ava did" log lines with long file names were clipped at 320 px: they now wrap.

## Known limits

- Cached extraction and cached AI outputs were written by hand without the model. They are labelled Cached.
- Live read, plan and recommend calls have not run against the model.
- No script yet regenerates `lib/aiScript.ts` from the model (`npm run build-cache` covers extraction only).
- Background requests are not interactive; their decisions are shown, not actionable.
- Ava logs every contract check as its own action, so Ava's action counts run higher than the brief's examples (about 35 at step 4, 77 at the end of Scenario A).
- Settings are illustrative and not enforced, except the autonomy switches, which the engine enforces.
- Session state lives in the browser; there is no server database or authentication.
- A Vercel preview exists for a branch `ava-sirion-positioning` that was not created in this build.
