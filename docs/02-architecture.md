# 02 Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 | One deployable app with server routes for AI calls and file text extraction |
| Styling | Tailwind CSS v4 with `@theme` tokens in `app/globals.css` (OKLCH accent), Inter and IBM Plex Mono | Design tokens in one place; reflows down to 320 px |
| State | Zustand store, persisted to `localStorage` | Each browser session is its own sandbox; Reset clears it |
| Engine | Plain TypeScript in `lib/engine/` | Policy is code, testable without the UI |
| AI | `@anthropic-ai/sdk`, validated with `zod` | Server-only; every response is schema-checked, retried once, then falls back |
| Files | `pdf-lib` + `@pdf-lib/fontkit` + `dejavu-fonts-ttf` (₹ glyph) to generate PDFs; `xlsx` (SheetJS) for spreadsheets; `unpdf` (serverless pdf.js) to read PDFs | Real PDFs and XLSX, readable on Vercel |
| Tests | Vitest (engine), Playwright via Python with system Chrome (walk-throughs and screenshots) | |
| Hosting | Vercel, auto-deploy from GitHub `main` | |

## One engine: event sourcing

State is never edited directly. Everything that happens is an **event**, and state is the replay of the event log:

```ts
state = events.reduce(applyEvent, initialState())
```

Event kinds (`AvaEvent` in `lib/types.ts`):

| Kind | Produced by | Carries |
|---|---|---|
| `email` | Story steps, the seed, the test lab composer | The `Email` (with attachments as extracted text pages), the `Extraction`, and its source (`live`, `cached`, `basic`) |
| `action` | People clicking, story steps acting as people, the `system` tick | `actor` (person id or `system`) and an `Action` |
| `ai` | Story steps (cached), the live AI hook (live) | `requestId`, `layer` (`read`, `plan`, `rec`), `key`, `output`, `source` |

Why this design:

- The guided demo is only a list of timed events fed to the same engine as a person typing an email (`lib/story.ts`). Nothing is faked on screen.
- Back and Reset are exact: drop events and replay.
- "Ava did N actions; people made M decisions" is counted from the log, never hardcoded.
- Tests run the same events without a browser.

`applyEvent(prev, ev)` (in `lib/engine/pipeline.ts`) `structuredClone`s the previous state, applies the event, then runs the rules over every request. Analysis results are cached per state object in `WeakMap`s (`analyze`, `folded`), so a new state object always gets a fresh analysis.

## The pipeline

```
email ─► ingest ─► classify ─► extract* ─► file ─► diff/fold facts ─► checkCommitments ─► rules ─► notify ─► log
action ─────────────────────────────────────────────────────────────────────────────────► rules ─► notify ─► log
ai ─► store versioned output (fingerprinted) ─► validate plan ─► log
```
\* Extraction runs before the event is created (AI, cache or basic extractor) and is stored on the event, so replay never calls the model.

| Stage | Where | What it does |
|---|---|---|
| Ingest | `ingestEmail` | Stores the email and its extraction. Our own sent drafts are recorded in the thread but never extracted. |
| Classify | `ingestEmail` | Finds a known supplier domain, or an unknown external domain with commercial content (₹, quote, invoice, order form, rate card, SOW). Internal or non-commercial mail is recorded and not filed. Invoices are routed to the invoice path. |
| File | `ingestEmail` | Supplier › Project › Request. Order: same thread; a `REQ-` reference; same supplier and project and cost centre; else a new request. Request ids advance with simulated time (about one every 16.4 h from REQ-1047) to reflect other teams' work, so the Kosha renewal is REQ-1063. Links the baseline agreement for renewals and the NDA/MSA on file. |
| Read attachments | `ingestEmail` | Logs "Read <file> (n pages) and pulled out the facts." per attachment (an Ava action). |
| Fold facts | `lib/engine/facts.ts` `foldFacts` | Folds fact events (from extractions and from people) in time order into fact records with state, origin, sources and versions. Rule 7 supersession keeps old versions. |
| Check commitments | `lib/engine/contracts.ts` `checkCommitments` | Checks the request against signed clauses. See [04](04-contracts-and-checks.md). |
| Rules | `lib/engine/rules.ts` `analyze` | Spend, routing, checklist, approvals and their status, conflicts, flags, drafts, handoff state, pipeline stage, who it waits on. See [03](03-policy-rules.md). |
| Notify | `runRules` in pipeline, `lib/engine/items.ts` | Opens and closes conflicts, flags, drafts; reopens approvals; logs each contract check once; marks "Started before approval"; records Ready and withdrawals; derives each person's items and tracks when each opened and closed. |
| Log | `req.timeline` | Every step writes a timeline entry. Entries with an `actor` (a person) are decisions; entries without one are Ava's actions. |

## State shape (`State` in `lib/types.ts`)

| Field | Meaning |
|---|---|
| `now` | Simulated clock (latest event time) |
| `emails`, `extractions` | Every email recorded and how it was extracted |
| `suppliers` | Seed suppliers plus any added by a person |
| `requests`, `requestOrder` | Request records: emails, fact events, documents, approvals (receipts), flags, exceptions, retro items, comments, timeline, checklist closures, approval cache, contract checks seen, contract issues, withdrawals |
| `conflicts` | Conflict records with sides, owner, status, resolution, impact, clauses, comments |
| `drafts` | Messages Ava drafted; a person sends them |
| `orphans` | Invoices with no request |
| `changes` | Material fact changes and the approvals they reopened |
| `items` | Open/close history of each person's items (for ages and wait times) |
| `reassigned` | Item reassignments |
| `counters` | Questions answered from documents, approvals reopened, started-before-approval by department |
| `threadRequest` | Email thread to request id |
| `ai` | `reads` and `plans` (versioned lists per request) and `recs` (by key) |

## Store (`lib/store.ts`)

Holds `events`, `state`, `viewAs`, the scenario position and checkpoints, the caption and focus URL of the current step, the source viewer target, `aiAvailable` (from `GET /api/ava`), pulse and toast. Actions: `act`, `addEmail`, `addAi`, `tick`, `next`, `prev`, `reset`, `setScenario`, `jumpTo`, `runContrast`, `openSource`, `setViewAs`. Persisted to `localStorage` under one key; on load the state is replayed from the saved events.

## File map

```
app/
  page.tsx                 Landing: headline, four AI verbs with screenshots, scenario buttons, counters
  mail/page.tsx            Captured mail: list, email or Outlook view, "Ava recorded" panel, test lab composer, Try this
  today/page.tsx           Today: needs your decision, coming up, what Ava handled
  requests/page.tsx        All requests (live and background), filters, group by supplier
  requests/[id]/page.tsx   Request case file; also the background request view
  dashboard/page.tsx       At risk, Ava caught this, counters, pipeline, timing, changes, orphan invoices
  conflicts/page.tsx       Every conflict, live and background
  suppliers/…              Supplier list and supplier page with Commitments
  story/[slug]/page.tsx    The six case pages
  settings/page.tsx        How Ava connects (illustrative)
  inbox/, items/           Redirects to /mail and /today (old routes)
  api/ava/route.ts         GET: is AI available; POST: extraction (kept for compatibility)
  api/ava/extract|read|plan|recommend   AI routes (Part 7)
  api/extract/route.ts     PDF/XLSX upload to text
components/
  Shell.tsx                Sidebar, top bar (clock, bell, View as), guided-demo dock, toasts, pulse
  ai.tsx                   AiLabel, CiteChip, useLiveAi, AvaRead, AvaPlan, AvaRecommends, AvaDid, ActsBanner, ContractCard, EmailChecks
  ConflictCard.tsx         The shared conflict card with actions and Ava recommends
  ItemCard.tsx             A decision card for Today and "Needs you"
  request.tsx              Facts table, checklist, routing, approvals, Decision Receipt, documents, timeline, drafts, handoff packet
  SourceViewer.tsx         Source modal: email text, attachment text with highlights, compare mode, contract PDF at a clause, original file
  casePages.tsx, story.tsx The six case pages
  ui.tsx, icons.tsx, ConnectDiagram.tsx, ConflictsTable.tsx
lib/
  engine/pipeline.ts       applyEvent, ingest, actions, AI events, runRules
  engine/rules.ts          analyze and the pure policy functions
  engine/facts.ts          Fact folding, supersession, document classification and diff
  engine/contracts.ts      Contract docs, clauses, supplier history, checkCommitments
  engine/ai.ts             Fingerprints, required steps, plan validation, plan diff, rules fallbacks, current outputs, action counts, prediction hit
  engine/items.ts          Each person's items
  engine/timing.ts         Cycle time and longest wait
  engine/world.ts          Seed world access
  aiTypes.ts               AI output types
  aiScript.ts              Cached AI outputs for scripted steps
  aiContext.ts             What the AI is given for a request or conflict
  aiLayers.ts              Server: read, plan, recommend calls with zod
  ai.ts                    Server: extraction call with zod
  insights.ts              At risk, catches, counters
  background.ts            Background requests and helpers
  story.ts, scripted.ts    Story steps and scripted emails
  cache.ts                 Extraction cache index
  basicExtractor.ts        Regex extractor (no AI)
  extractClient.ts         Client-side extraction call with fallback
  extractText.ts           Server-side PDF/XLSX text
  store.ts, types.ts, format.ts, samples.ts, summary.ts
data/
  seed.json, contracts.json, background.json, extraction-cache/*.json, sample-texts.json (generated)
scripts/
  make-samples.ts          Generates sample PDFs/XLSX, contract PDFs and sample-texts.json
  build-cache.ts           Regenerates the extraction cache with the real model
tests/engine.test.ts
public/samples/ (generated), public/screens/ (landing screenshots)
```
