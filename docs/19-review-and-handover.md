# 19 Product review and handover

A record of the product review that drove revision 4, what was decided, what was verified, what is still open, and how to finish. Written 22 Nov 2026. The technical detail of the new features is in [18 Ask Ava](18-ask-ava.md) and ADRs [0011](adr/0011-routine-messages-may-be-sent.md), [0012](adr/0012-north-star-on-own-time.md) and [0013](adr/0013-shared-log-per-window-viewer.md); this page is the why, the status and the runbook.

## 1. The mandate and where each part lives

The brief: a 3,000-person company with about 2,500 suppliers runs contracts through email, Word and Excel. Pick one lifecycle stage and build a working, AI-powered prototype. The prototype itself must carry five things.

| The brief asks for | Where it is | Notes |
|---|---|---|
| Chosen stage | Contract **intake**: "turn scattered requests into structured, routed, trackable work" | Case page 1, [Why intake](/story/why) |
| Why this stage | `/story/why`: five failures from the brief traced back to intake; why not negotiation or the repository | |
| Stakeholder map and conflicts | `/story/stakeholders`: speed vs control, wants and worries per role, seven named clashes, how one action reaches several people | Suppliers and employees are on the map |
| The problem and how we know it is real | `/story/problem`: sourced stat cards, who it hurts, three testable hypotheses, and an explicit "How sure are we?" note | Evidence is vendor data; the pilot replaces it with Prayaan's own |
| The working prototype, end to end | `/` (landing and guided demo), `/new` (Ask Ava), `/mail`, `/today`, `/requests`, `/dashboard`, `/supplier/[id]`, `/settings` | Scenario A (new project), Scenario B (renewal), and the repeat request |
| Success metrics | `/story/metrics`: one north star, drivers, baseline and pilot plan, eight rethink triggers | |
| Assumptions (the brief says to state them) | `/story/assumptions` | Includes how much Ava does, and what is simulated |
| Who it is for, and how much it does | Requesters, Procurement, approvers, InfoSec, Legal, Finance, and the supplier. Ava reads, plans, acts on routine messages, and advises. People decide | See the autonomy ladder in `/settings` |

## 2. The product review

The review was done as a senior product manager reading the docs, the code and the running app against the brief. It found the product coherent and well engineered, but narrower than the problem the brief describes. Each finding below has a status.

| # | Finding | Why it mattered | Status |
|---|---|---|---|
| 1 | The AI is not shown to be real: no API key, every read, plan and recommendation is hand-written and labelled Cached; the live routes have never run | The first thing a reviewer asks is "is this AI?" | **Open by decision.** The key is added last. Runbook in section 6 |
| 2 | No front door: Ava only sees supplier email after the employee has already contacted the supplier | The brief's failure is requests getting lost, which happens before any supplier email. It also contradicted the product's own "ask first" principle | **Fixed.** Ask Ava (`/new`) |
| 3 | The contract checks assume a repository of clauses that does not exist; the contracts were entered by hand | The brief says signed contracts are rarely looked at again | **Open.** Stated in Assumptions; roadmap X6 (clause extraction) |
| 4 | One scripted hero story; narrow contract types | A reader cannot tell whether it generalises | **Accepted by decision** (time). Rules-based extraction handles composed email and the test lab |
| 5 | The stakeholder connection was simulated: state in one browser, one person flipping personas | The brief asks how the experiences connect | **Partly fixed.** Windows of one browser share the log and update live; "What this reached" names who each change touched; the supplier has their own view. Two people on two computers remains open (X2) |
| 6 | The metrics were weak: action counts as headline, "forms filled: 0" true by construction, a 1-day target the hero scenario missed by 2 days, no baseline | The brief asks for a north star and what would make us rethink | **Fixed.** New north star on Prayaan's own time; baseline and pilot plan; eight thresholds each with a predefined response |
| 7 | Autonomy was too cautious: every action needed a click, even a routine quote request | The brief asks how much the product takes on | **Fixed.** Autonomy ladder and two switches |
| 8 | Smaller issues | | See below |

Finding 8, in detail:

| Issue | Status |
|---|---|
| Demo bar covered the page on phones | Fixed: starts as a pill under 640 px |
| A returning visitor landed mid-demo with no explanation | Fixed: resume or start over banner |
| Request page very long | Partly fixed: finished plan steps fold away after two. The page is still long |
| No supplier-side experience | Fixed: `/supplier/[id]` |
| Sample PDFs changed on every regeneration; `sample-texts.json` was stale (missing `Trivenika_Proposal_v3.pdf`) | Fixed: fixed dates, no update metadata, regenerated |
| "Forms filled: 0" and action counts as headline tiles | Fixed: touches per request, clean and fast, started in Ask Ava; activity in small print |
| No scale story for 2,500 suppliers (queue, SLA clocks, prioritisation) | Open |
| No approver delegation or out-of-office | Open (items can be reassigned) |
| No dark mode | Open (design debt in doc 14) |

Found while building and fixing, not by the original review:

- The duration parser read "in 3 weeks" (the start) as the duration. Fixed, with a test.
- The "Ask Ava" supplier-name rule did not match "We need Urban Shine Facility Services". Fixed, with a test.
- The draft header said "Ava does not send it" even for messages Ava sent. Fixed.
- The draft greeted the supplier as "arjun.d" instead of "Arjun". Fixed.
- `.env.example` was missing from the repo: `.gitignore` excluded every `.env*` file, while the README and developer guide told people to copy it. Fixed in this change.

## 3. Decisions taken, and why

| Decision | Reason |
|---|---|
| Add a front door rather than extend email capture | Intake starts before the supplier email. Ask Ava also lets Ava tell the supplier "no work before a PO" on day one |
| Ask Ava reads text with rules, not a model | Works without a key and is testable. The output shape matches the model's, so a model can replace it later |
| Approvers are not asked until a written quote confirms the amount | Nobody should sign for a rough number. The existing gate already did this; Ask Ava relies on it |
| Autonomy is per kind of message, never per decision | A routine message commits no money and changes no terms. A decision does both. Quote requests are on by default; document chasers are off so the demo still shows the draft path |
| North star measured on Prayaan's own time, supplier waiting excluded | Scenario A takes 3 business days on the calendar, almost all of it the supplier. A calendar target punishes us for the supplier and rewards nothing we control |
| Own time is a critical-path measure, and says so | If an approver sits on a request while the supplier is also late, that wait is hidden. The touches metric covers people's effort. The limit is written on the page |
| Share the event log across windows, keep "who am I" per window | Gives a real two-person demo without a server. ADR 0013 |
| Stay with the single hero story | Chosen by the product owner because of time |
| Add the API key last | Chosen by the product owner. Everything else was built to work without it and says so |
| No numbers invented for the baseline | There is no internal data. The page shows how week 1 produces it |

## 4. What was verified

Run on 22 Nov 2026 against `main` after the pull requests below.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean |
| `npm test` | 42 tests pass: engine and scenarios 26, evals 3, Ask Ava and autonomy 10, metrics 3 |
| `npm run eval` | 27 cached outputs checked, 0 failing (cached only: the live path has not run) |
| `npm run build` | Passes; routes include `/new` and `/supplier/[id]` |
| Live site, cold start (storage cleared) | `https://sirion-ava-agent.vercel.app`: landing, Scenario A and B to the end, Ask Ava to a new request, six case pages and dashboard load with no page errors |
| Scenario A, live | Ready for Legal Review. "Took 3 business days on the calendar. Prayaan's own time: 40 min. The rest, 5 days, was waiting on the supplier." |
| Scenario B, live | Ready to issue PO. Prayaan's own time 1.9 h; supplier wait 8.2 days |
| Ask Ava, live | Rahul's example shows the VP limit, InfoSec and the competing quote before saving, then opens a request and sends the routine message |
| Two windows | A repeat request started in one window appeared in the other without a refresh, with "What this reached" naming the person it reached; each window kept its own "viewing as" |
| Phone width (375 px) | Demo bar is a pill; landing page readable |
| `/api/ava` on the live site | `{"ai": false}`, as intended |
| Fresh clone | A clean `git clone` of `main`, then `npm ci` and `npm test`: 42 tests pass with no extra steps |

Not verified: anything that needs a model key (live extraction, read, plan, recommendation).

## 5. Known gaps

- **Live AI has never run.** Cached outputs are hand-written in the real response shape and labelled. The routes validate with zod and fall back to rules.
- **Cross-computer state.** The log is shared by windows of one browser. Two people on two computers do not see each other. The first production task is storing the same log in a database; the engine does not change (X2).
- **Notifications.** There is no email or Slack delivery. The most valuable next step is a digest with a one-click link to the Decision Receipt, so an approver can approve from the message (X7).
- **Contract repository.** Contracts are hand-entered. Clause extraction with Legal confirming once is X6.
- **Breadth.** One hero story. A second contract type through Ask Ava (for example a staffing agency) would show the checklist changing by type.
- **Own-time measure** hides an approver's wait behind a supplier's. Stated on the Metrics page.
- **Ask Ava uses rules, not a model, even with a key.** Routing it through `/api/ava/extract` is a small change.
- **Request page length** is still high on a request with many conflicts.
- **Scale:** no queue, SLA clocks or prioritisation for Procurement at 200 requests a month.

## 6. Runbook: turning on live AI

Do this last. Allow a day: live output may need prompt fixes.

1. **Locally.** `cp .env.example .env.local`, set `ANTHROPIC_API_KEY`, run `npm run dev`. Open `/api/ava`: it should return `{"ai": true}`.
2. **Try it live.** In Captured mail use "Test lab: simulate an incoming email" with an attachment, and on a conflict card press "Re-run Ava". Look for the **Live AI** label and, if any output breaks a promise in the prompt, the "n checks failed" badge.
3. **Regenerate the extraction cache.** `ANTHROPIC_API_KEY=... npm run build-cache`. Review the diff in `data/extraction-cache/`, then run `npm test` and `npm run eval`.
4. **Know what stays cached.** The read, plan and recommendation outputs for the scripted steps (`lib/aiScript.ts`, `data/background.json`) are hand-written. There is no script to regenerate them yet (roadmap N2). With a key, a request asks the model again when its facts change and its shown read or plan is the rules fallback; scripted steps keep their Cached label until then.
5. **Vercel.** Project, Settings, Environment Variables: add `ANTHROPIC_API_KEY` for Production (and Preview if wanted), then redeploy. `GET https://sirion-ava-agent.vercel.app/api/ava` should return `{"ai": true, "model": "claude-sonnet-5-5"}`.
6. **Roll back** by removing the variable and redeploying. The app falls back to labelled rules output.
7. **Watch** the eval badge and the cost. Roadmap N3 (a model-graded faithfulness check) and N5 (prompt versioning) are the next two items.

## 7. Submission checklist

| Item | Status |
|---|---|
| Live link works and is the current build | Yes: `https://sirion-ava-agent.vercel.app` |
| Five required sections inside the prototype | Yes (section 1) |
| Cold start has no leftover state | Yes; a saved mid-demo session shows a resume or start-over banner |
| Tests, types, build | Pass (section 4) |
| Fresh clone installs and passes tests | Yes: `git clone`, `npm ci`, `npm test` gives 42 passing |
| `.env.example` present | Added with this change |
| Add the API key | Open, by decision (section 6) |
| Submit from `Sirion_Ava_Agent/` | The older un-versioned copy in the parent folder (`ava/`, roughly the first commit) must not be submitted |

## 8. History of this revision

| Pull request | What |
|---|---|
| #2 | Design floor pass on the landing and request page; status line fix |
| #3 | Ask Ava, autonomy, own-time north star, supplier view, "What this reached", windows sync, docs 18 and ADRs 0011 to 0013 |
| #4 | Deterministic sample files; `sample-texts.json` brought up to date |
| #5 | Ask Ava link on the Why page; stale metric and roadmap wording fixed |
| This change | This page, `.env.example`, `.gitignore` exception |

The work was done by three Claude sessions in the same folder: the first built and deployed the prototype and set up the machine; the second did the product review and the code for revision 4; the third wrote docs 18, the three ADRs and the doc edits. Two housekeeping items remain for a person: delete the merged branches `ask-ava-autonomy`, `regenerate-samples` and `design-floor-pass` on GitHub (all three are fully contained in `main`), and decide what to do with the older copy in the parent folder. `gh` is installed at `~/.local/gh/bin` and is not on the default PATH.
