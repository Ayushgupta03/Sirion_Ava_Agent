# 15 Developer guide

How to work on Ava without breaking it. Read [02 Architecture](02-architecture.md) first.

## Setup

```bash
git clone https://github.com/Ayushgupta03/Sirion_Ava_Agent.git
cd Sirion_Ava_Agent
npm install
cp .env.example .env.local     # optional: add ANTHROPIC_API_KEY
npm run dev                    # http://localhost:3000
```

Node 20+. The first `dev` or `build` runs `npm run samples`, which writes `public/samples/*` and `data/sample-texts.json`. These files are tracked in git. Generation is deterministic (PDFs carry a fixed date and no update metadata), so regenerating gives identical files; copies committed before that change still differ once, until they are regenerated and committed.

**Run `npm run samples` once before `npm test` on a fresh clone.** The tests read `data/sample-texts.json`; without it they fail to load ("no tests").

**macOS without Homebrew:** install Node from the official tarball (`node-v22.x-darwin-arm64.tar.gz` from nodejs.org, checked against `SHASUMS256.txt`) into `~/.local`, and put `~/.local/node/bin` on your `PATH`. Next.js starts a separate `node` process for PostCSS, so `node` must be on the `PATH` of whatever starts the dev server, not only called by full path.

**Pushing without a password:** install the GitHub CLI and run `gh auth login --web`; it signs in through the browser (Continue with Google works) and sets up git.

## Daily loop

```bash
npx tsc --noEmit      # types
npm test              # 42 engine, scenario, intake, metrics and eval tests
npm run eval          # AI output checks for every cached output
npm run build         # what Vercel runs
```

All four must pass before you push to `main` (it deploys to production).

## Mental model in five lines

1. Everything is an event (`email`, `action`, `ai`). State is the replay of events.
2. `applyEvent` clones state, applies the event, then `runRules` re-analyses every request.
3. `analyze(state, reqId)` is the single source of derived truth: facts, spend, routing, checklist, approvals, conflicts, checks, flags, drafts, handoff.
4. The UI only reads `state` and `analyze`, and dispatches actions through the store.
5. AI outputs are events too; code validates them and evals check them.

## Conventions

- Policy and money live in `lib/engine/`. Never compute a rupee or date in a component or in a prompt.
- Every engine change gets a test in `tests/engine.test.ts` that runs real events.
- Every log line without an `actor` counts as an Ava action. Pass the person as `actor` for decisions.
- Ids are stable and descriptive: conflicts `cf:<req>:<type>:<key>`, flags `flag:<req>:<what>`, items `item:<flag or key>`.
- UI copy follows [14 Design system](14-design-system.md). Run the banned-word scan: `grep -rniE "\b(seamless|powerful|leverage|unlock|cutting-edge|empower|game-changer|revolutionary|intelligent|smart)\b" app components lib`.
- Page files under `app/` may only default-export (Next.js); put helpers in `lib/` or `components/`.

## Recipes

### Add a policy rule

1. Add the rule to `computeRouting` (if it changes approvers or the end state) with a `RuleFired` entry so the "Why these approvers?" drawer explains it.
2. If it needs a checklist item, add it in `analyze`'s checklist block with an owner role and a "how" text.
3. If the plan should include it, add the mapping in `requiredSteps` and a status in `stepStatus` (`lib/engine/ai.ts`).
4. Test: a scenario-level test asserting the approval or checklist item appears and the handoff waits for it.

### Add a conflict type

1. Add the type to `ConflictType` in `lib/types.ts` and a label in `CONFLICT_TYPE` (`components/ConflictCard.tsx`).
2. Push a `ConflictSpec` in `analyze` with a stable id, sides A and B with quotes (`Source`), `whyItMatters`, owner, `blocks`, `resolveText`, and `impact`/`impactText` if it has a rupee or risk effect.
3. The pipeline opens it, updates it while open, and closes it when it disappears from `analyze` (with `resolveText`). Catches appear on the dashboard automatically if `impact` or `impactText` is set.
4. Add a cached recommendation for scripted steps, or let the live layer produce one.

### Add a contract check

1. Add the clause to `data/contracts.json` with a `kind` (and `due`, `value`, `keywords` as needed). `npm run samples` regenerates the PDF.
2. In `checkCommitments` (`lib/engine/contracts.ts`), push a `Check` (consistent, conflict or note) with the clause and the email it came from; push a `ContractConflict` with code-computed `impact` when it breaks the contract; add the clause to `clauses` if it should show on the contract card.
3. Test the numbers exactly (see the ₹39,200 and ₹90,000 tests).

### Add or change an AI layer

1. Types in `lib/aiTypes.ts`; zod schema and task prompt in `lib/aiLayers.ts`; route in `app/api/ava/<layer>/route.ts`.
2. Context in `lib/aiContext.ts`. Give the AI every number it may mention in `numbersFromCode` (the eval fails numbers that code did not provide).
3. Store as an `ai` event (`applyAi` in the pipeline). Add a rules fallback in `lib/engine/ai.ts`.
4. Add eval checks in `lib/evals.ts` and run `npm run eval`.
5. Render with `AiLabel` and `EvalBadge`.

### Change a prompt

Edit `RULES` or `TASK` in `lib/aiLayers.ts` (or `SYSTEM_PROMPT` in `lib/ai.ts` for extraction). Then run `npm run eval`. With a key, compose a few test-lab emails and check the badges and timeline for "failed output check". Bump the prompt version once roadmap N5 lands.

### Add a story step

Add a `Step` in `lib/story.ts` with time, label, caption (plain, one or two sentences), focus URL, pulse target and events (`email()`, `act()`, `tick()`, `read()`, `plan()`, `rec()`). Add any new email to `lib/scripted.ts`, its sample file to `scripts/make-samples.ts`, its extraction to `data/extraction-cache/` and `lib/cache.ts`, and cached AI outputs to `lib/aiScript.ts`. Then `npm test` and `npm run eval`.

### Add a screen

Create `app/<route>/page.tsx` (client component, default export). Read with `useAva((s) => s.state)` and `analyze`. Add it to `NAV` in `components/Shell.tsx`. Add `data-pulse` targets if a story step should highlight it.

### Add background data

Edit `data/background.json` (fields in [08](08-data.md)). Keep reads consistent with the project name, name people instead of roles, and give every Today person at least one decision, one coming-up step and one Ava action.

## Debugging

- **See the event log:** in the browser console, `JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.includes("ava"))))`.
- **Reset:** the reset button in the dock, or clear localStorage.
- **A step looks wrong:** reproduce it in a test with `run(SCENARIO_A, n)` and inspect `analyze(s, id)`.
- **A conflict closes and reopens:** its id is not stable; key it by something that survives new documents.
- **An AI output shows "Summary from rules":** its fingerprint no longer matches; a new read or plan is needed for the current facts.
- **Hydration flashes:** the shell shows skeletons until the store hydrates from localStorage.

## Gotchas

- `analyze` is cached per state object. Never mutate a state you got from the store; go through `applyEvent`.
- `fmtDT` returns IST (`Thu 12 Nov, 10:12`); dates in data are ISO with `+05:30`.
- `parseDate` assumes 2026 when the year is missing.
- `inr` gives full Indian format; `lakh` gives `₹21.11L`.
- Request ids depend on simulated time (`nextReqId`), so tests use `threadRequest` to find them.
- Background requests are static and never enter `state.requests`.
