# 05 AI layers

Five places use AI. Each has a schema, a server route, a cached path and a rules-only fallback. Labels on every AI output say which path produced it:

| Label | Meaning |
|---|---|
| **Live AI** | The model answered this request now (needs `ANTHROPIC_API_KEY`) |
| **Cached** | Stored output for scripted steps and background requests, same shape as a live answer |
| **Simulated** | Written by code from the facts, with no model. Used when no stored or live output fits the current facts. This is what every composed email, Test Lab email and Ask Ava request gets, because the prototype ships with no model key by decision |
| Basic extraction (rules) | Extraction label when the regex extractor ran instead of the model |

## Shared rules for every call

System prompt (`lib/aiLayers.ts`, and the extraction prompt in `lib/ai.ts`):

- Use only the sources given in the input. Never add facts.
- Cite every factual claim (`{type: "email" | "doc" | "clause", id, quote?}`).
- Never compute money or dates. Use only the numbers code provides.
- Never decide or recommend that an approval be given. Approvals belong to people.
- Plain, short sentences. Names, numbers, dates. No banned words (seamless, powerful, leverage, unlock, cutting-edge, empower, game-changer, revolutionary, intelligent, smart).
- Predictions that use supplier history end with "Based on sample history in this prototype."

Every response is parsed as JSON, validated with zod, retried once with "Your previous answer did not match the shape", then the client falls back.

## 1. Extraction

| | |
|---|---|
| Route | `POST /api/ava/extract` (also `POST /api/ava` for compatibility); `GET /api/ava` returns `{ai, model}` |
| Code | `lib/ai.ts` `extractWithAI`, `ExtractionSchema` |
| Input | The email, attachment text by page, known suppliers, open requests |
| Output | `isSupplierCommunication`, `supplier`, `filing` (project, request id or NEW, type, confidence, reason), `facts[]` each with an exact quote and source, `changesVsKnown`, `flags`, optional draft |
| Cached | `data/extraction-cache/<emailId>.json` for every scripted email (e-a1…e-a6, e-b1, e-b3, e-b4, e-c1, e-c2, e-k1); indexed in `lib/cache.ts` |
| Fallback | `lib/basicExtractor.ts`: regex over body and attachments, same shape, lower confidence |
| Client | `lib/extractClient.ts` posts to `/api/ava/extract`; on error uses the basic extractor and keeps the error note |

Tests prove the scenarios reach the same outcomes with the basic extractor and no cache.

## 2. Ava's read (makes requests structured)

| | |
|---|---|
| Route | `POST /api/ava/read` |
| Input | `requestContext(state, reqId)` from `lib/aiContext.ts`: request, `numbersFromCode` (amount, 90-day total, spend text, handoff state and reasons), facts with sources, approvals, checklist, commitments (checks), conflicts with impact and clauses, emails with attachment text, supplier history, people, required steps, previous plan |
| Output | `{sentences: [{text, citations[]}] (1–4, each with at least one citation), risks[]}` |
| Shown | Top of every request page (with citation chips), one line at the top of the "Ava recorded" panel in Captured mail, final read in the handoff packet |

Versioning: each read is stored in `state.ai.reads[reqId]` with a **fingerprint** of what it depends on (amount, scope, data access, duration, auto-renew, open conflict ids, contract check statuses). The read is current only while the fingerprint matches. The page shows "Updated Fri 13 Nov, 09:48 · see previous" and can show the previous version. If facts changed and no new read exists, the page shows the rules fallback with a note, and (with a key) the live hook fetches a new one.

Rules fallback (`rulesRead`): who wants which supplier for what and how much; open problems by title; the 90-day total against the ₹25L limit.

## 3. Ava's plan (makes requests routed)

| | |
|---|---|
| Route | `POST /api/ava/plan` |
| Input | The same request context, including `requiredSteps` from the rules engine and the previous plan |
| Output | `{steps: [{id, title, ownerId, source: "policy" or "ava", reason, dependsOn[], status, eta}], criticalPath[], predictedReady, predictionReason, changesSinceLast[]}` |

Code validates every plan (`validatePlan` in `lib/engine/ai.ts`):

1. Every policy-required step must be present. `requiredSteps(analysis)` lists them from approvals (budget, VP, InfoSec) and checklist items (competing quote, DPA, security certificate, insurance, GST if not done, renewal terms, retro). Missing ones are inserted with reason "Added by policy check" and logged on the timeline. Required steps are forced to `source: "policy"` and the policy owner.
2. Owners must exist (people, `ava`, or a supplier). Unknown owners are reassigned to Karan and logged.
3. No cycles: dependencies to unknown ids are dropped; edges that close a cycle are removed and logged ("Removed a circular dependency: …").
4. Status is overridden by the engine for steps it knows (`approve-budget`, `approve-vp`, `approve-infosec`, `competing`, `dpa`, `security-cert`, `insurance`, `gst`, `renewal-terms`, `retro`, `get-quote`, `confirm-data`, `check-nda-msa`, `resolve-rates`, `resolve-delivery`, `resolve-uat`, `handoff`). A reopened approval shows as Reopened; a blocked handoff as Blocked.

"What changed in the plan" (`planDiff`) is computed by code against the previous version: added steps, steps done, "Budget approval reopened", "VP approval reopened", "Handoff blocked" (when approvals reopen), "Predicted date unchanged: Tue 17 Nov" or "Predicted ready moved: X → Y", plus the AI's own `changesSinceLast` (deduplicated). The rules engine stays the source of truth for handoff; the plan never overrides it.

Prediction: the plan's `predictedReady` and its one-sentence reason. When the request becomes ready, `predictionHit` finds the first plan that predicted the actual day: "Predicted on Thu 11:40: Tue 17 Nov. Actual: Tue 17 Nov 11:05."

Rules fallback (`rulesPlan`): the policy-required steps, plus the two steps every request has: "Get <supplier>'s written quote" (until a quote, order form or SOW is on file; approvers sign nothing without it) and the handoff. "Not predicted: AI unavailable."

Shown as a vertical list: status icon, title, "Required by policy" (blue) or "Added by Ava" (violet) badge, "Critical path" marker and left border, owner, "by" date, reason. Header: steps done, predicted ready and reason (or the actual ready time and the prediction line).

## 4. Recommendations (show judgment)

| | |
|---|---|
| Route | `POST /api/ava/recommend` |
| Input | `conflictContext(state, conflictId)`: the conflict and the request context |
| Output | `{recommendation, reasoning, citations[], confidence: high/medium/low, draft?, action?}`; actions `draft_supplier`, `ask_requester`, `require_cr`, `ask_legal`, `review`. Receipt summaries use `bullets[]`. |
| Stored | `state.ai.recs[key]`, key = conflict id, or `receipt:<reqId>:<approvalKey>` for Decision Receipt summaries |

The **Ava recommends** box appears on every conflict card and on decision cards (Today and "Needs you"): recommendation, reasoning with citation chips, confidence chip, label, and the ready draft or question (collapsed).

Buttons, each logged as a **human decision** with the person as actor:

| Button | Effect |
|---|---|
| Use this draft / Ask with one click / Use this | `rec_use`. `draft_supplier`: creates a draft linked to the conflict for the person to send. `ask_requester`: creates a one-click question (`keep_line` flag) for the requester. `require_cr`: resolves the conflict and records the contract issue. Otherwise: logged only. |
| Edit | Edit the draft, then "Use edited draft" (`rec_use` with the edited text; logged as "(edited)") |
| Dismiss with a reason | `rec_dismiss`, reason recorded |

Ava never applies an approval, a credit or a rejection herself. Decision Receipts open with "Ava's summary for you" (3 bullets) when a summary exists, and say "The decision is yours; Ava never approves."

Simulated advice (`simulatedRec` in `lib/engine/simulated.ts`): when no recommendation is stored for a conflict, Ava's advice is written from the conflict itself, at medium confidence, labelled **Simulated**. It meets the model's contract: reasoning of at most two sentences, a citation taken from the conflict's own quotes, and no money figure that code did not produce. It never approves, rejects or applies a credit. A test runs it through `evalRec` for every conflict either scripted scenario produces.

| Conflict | Advice | Action |
|---|---|---|
| Goes against the contract | Ask the supplier to reissue it within the agreement (clause named), with the contract line and the supplier's line quoted | Draft to the supplier |
| Said vs written | Ask the supplier to confirm in writing which figure applies, naming both | Draft to the supplier |
| Renewal terms changed | Hold the renewal and ask the supplier to confirm the changed terms within the clause | Draft to the supplier |
| Hidden scope or data access | Ask the requester whether the supplier will touch customer data; if yes, InfoSec and a DPA | Advice only |
| Started before approval | Record why work began early, then ask the budget owner for a retrospective approval | Advice only |

Using or dismissing it is logged like any other recommendation, and the simulated text is what gets stored (`rec_use` and `rec_dismiss` keep it). For a kind of conflict with no simulated advice, the plain "Review the conflict." stub remains, with no primary button.

The Decision Receipt's three-line summary is simulated the same way (`simulatedReceipt`) when no stored summary exists: what you are approving, what is open, and the 90-day total or the checks made. All figures come from the rules engine.

## 5. Ava did / Needs a person (shows action)

Not a model call: computed from the event log (`actionsOf` in `lib/engine/ai.ts`). Timeline entries without a person actor are Ava's actions: read an email, read an attachment, filed, linked a document, checked a contract term, opened a conflict, drafted a message, prepared a receipt summary, read/re-planned, recommended, raised a flag, closed a checklist item, reached Ready. Entries with a person actor are decisions.

Shown as:

- Request page: "Ava did N things · people made M decisions" (expandable log, newest first, Ava or the person's first name on each line).
- Ready banner and handoff packet: "Ava did N actions; people made M decisions." Scenario A end: 77 and 13.
- Today: "Since yesterday, Ava handled X things for you", from the last 36 hours of Ava actions on requests the person is involved in, plus background actions tagged for them.
- Dashboard and landing: Ava actions vs people decisions across all requests, including background.

## Prompt versions and re-planning

Every live output records the **prompt version** (a short hash of the system and task prompts, `PROMPT_VERSION` in `lib/aiLayers.ts`) and the model that produced it. Hover a "Live AI" label to see both. Scripted outputs carry neither: they were written by hand and say so.

A plan depends on more than the facts: it also depends on who has signed and how many emails the request holds (`planContext` in `lib/engine/ai.ts`). When a **live** plan's facts still hold but its context has moved, `currentPlan` returns `refresh: true`, the plan header says "Re-planning after the latest approval or reply…", and `useLiveAi` asks for a new plan, whose "What changed" lists what the approval or reply did. Reads and recommendations ignore the context: an approval does not change what an email said. Cached plans never refresh, because nothing can regenerate them.

Extraction ignores quoted earlier messages in a reply (`lib/quoted.ts`): a price that only appears in the quoted thread never becomes a fact. The captured-mail view folds that part away and says Ava ignores it.

## Live calls from the client

`useLiveAi(reqId)` in `components/ai.tsx` runs on the request page and the "Ava recorded" panel. If AI is available and the read or plan shown is the rules fallback (missing or stale fingerprint), it posts the request context to `/api/ava/read` and `/api/ava/plan`, and for each open conflict without a recommendation to `/api/ava/recommend`. Results are added as `ai` events with source `live` (store `addAi`), so they are versioned, validated, logged and replayable. Each `(request, layer, fingerprint)` is requested once per page load; failures leave the fallback in place.

## Cached outputs for scripted steps

`lib/aiScript.ts` holds the reads, plans and recommendations for Scenario A and B in the exact output shapes. Story steps append them as `ai` events with source `cached` (see [06](06-scenarios.md)). Background requests carry cached reads, plans, recommendations and Ava actions in `data/background.json`.

**These were written by hand to match the substance required by the revision brief, because no API key was available.** Live calls fire only when the stored output is missing or stale, so with a key the scripted steps still show their cached text while composed email gets Live AI. To replace the cached text with model output, call the three routes with `requestContext` at each step and paste the results into `lib/aiScript.ts` (a script for this is not written yet). `npm run build-cache` regenerates the extraction cache only.

## Settings for the key

See [10 Deployment](10-deployment.md). Model default `claude-sonnet-5-5`, overridable with `AVA_MODEL`.
