# 16 API reference

All routes are Node.js serverless functions (`maxDuration` 60 s). AI routes return `503` when no key is set and `502` when the model fails twice; the client then falls back.

## `GET /api/ava`

```json
{ "ai": false, "model": "claude-sonnet-5-5" }
```

## `POST /api/ava/extract` (also `POST /api/ava`)

Request:

```json
{
  "email": { "from": "arjun.d@trivenika.example", "to": ["rahul.mehta@prayaan.example"], "cc": [], "subject": "RE: Salesforce migration", "body": "…", "sentAt": "2026-11-12T11:40:00+05:30", "threadId": "t-sfm" },
  "attachments": [{ "name": "Trivenika_Proposal_v1.pdf", "text": "--- page 1 ---\n…" }],
  "context": { "knownSuppliers": [{ "name": "Trivenika Systems Pvt Ltd", "domain": "trivenika.example", "known": true }], "openRequests": [{ "id": "REQ-1047", "title": "…", "supplier": "trivenika", "project": "Salesforce migration", "thread": "t-sfm" }] }
}
```

Response `{ "source": "live", "result": Extraction }`:

```json
{
  "isSupplierCommunication": true,
  "supplier": { "name": "Trivenika Systems Pvt Ltd", "domain": "trivenika.example", "known": true },
  "filing": { "project": "Salesforce migration", "request": "REQ-1047", "requestType": "new_sow", "confidence": "high", "reason": "Same thread." },
  "facts": [{ "field": "amount_pre_gst", "value": "₹20,00,000", "state": "confirmed", "source": { "file": "Trivenika_Proposal_v1.pdf", "page": 1, "quote": "Subtotal (before GST) ₹20,00,000" } }],
  "changesVsKnown": [],
  "flags": [{ "type": "unconfirmed", "message": "Admin access to customer records", "sendTo": "requester" }]
}
```

Fact fields: `amount_pre_gst, gst, total, start_date, duration, scope, data_access, payment_terms, validity, supplier_entity, renewal_date, notice_period, certificate_expiry, other`.

## `POST /api/ava/read`

Request: `requestContext(state, reqId)` (`lib/aiContext.ts`):

```json
{
  "today": "2026-11-12T11:40:00+05:30",
  "request": { "id": "REQ-1047", "title": "New SOW: Salesforce migration", "type": "new_sow", "supplier": "Trivenika Systems Pvt Ltd", "project": "Salesforce migration", "requester": "Rahul Mehta", "costCentre": "CC-SALESOPS" },
  "numbersFromCode": { "amount": "₹20,00,000", "total90": "₹38,00,000", "spendText": "₹9L + ₹9L + ₹20L = ₹38L", "overLimit": true, "vpLimit": "₹25,00,000", "handoff": "blocked", "handoffReasons": ["…"], "renewalSaving": null },
  "facts": [{ "field": "Amount (before GST)", "value": "₹20,00,000", "state": "confirmed", "source": { "emailId": "e-a2", "file": "Trivenika_Proposal_v1.pdf", "attachmentId": "e-a2-att1", "quote": "…" } }],
  "approvals": [], "checklist": [],
  "commitments": [{ "clauseId": "TV-MSA-2024 5.3", "status": "conflict", "text": "Senior Salesforce Developer ₹2,00,000: over the 8% cap (₹1,94,400) by ₹22,400." }],
  "conflicts": [{ "id": "cf:REQ-1047:contract:rates:TV-MSA-2024", "title": "Rates break the MSA cap by ₹39,200", "status": "open", "type": "against_contract", "impact": "₹39,200 over the MSA rate cap", "clauses": ["TV-MSA-2024 5.3"] }],
  "emails": [{ "id": "e-a2", "from": "…", "subject": "…", "body": "…", "attachments": [{ "id": "e-a2-att1", "name": "…", "text": "…" }] }],
  "supplierHistory": [{ "what": "ISO certificate renewal", "businessDays": 4 }],
  "people": [{ "id": "rahul", "name": "Rahul Mehta", "roles": ["requester"] }],
  "requiredSteps": [{ "id": "approve-budget", "title": "Budget approval at ₹20L", "ownerId": "ananya" }],
  "previousPlan": null
}
```

Response `{ "source": "live", "promptVersion": "9f3a1c20", "model": "claude-sonnet-5-5", "result": AiRead }`. `promptVersion` is a hash of the prompt text (`PROMPT_VERSION` in `lib/aiLayers.ts`), so it changes whenever a prompt does. The plan and recommend routes return the same two fields. They are stored on the output and shown in the AI label's tooltip:

```json
{ "sentences": [{ "text": "Proposal v1 prices the Salesforce migration at ₹20,00,000 for 8 weeks from Mon 16 Nov.", "citations": [{ "type": "doc", "id": "e-a2-att1", "quote": "Subtotal (before GST) ₹20,00,000" }] }], "risks": ["Rates over the MSA cap by ₹39,200"] }
```

Citation ids: `email` → email id; `doc` → attachment id or contract id (e.g. `SOW-0438`); `clause` → `"<contract id> <clause>"` (e.g. `"TV-MSA-2024 5.3"`).

## `POST /api/ava/plan`

Request: the same request context. Response `AiPlan`:

```json
{
  "steps": [
    { "id": "approve-budget", "title": "Budget approval", "ownerId": "ananya", "source": "policy", "dependsOn": ["get-quote"], "status": "todo", "eta": "Thu 12 Nov" },
    { "id": "security-cert", "title": "Renewed ISO 27001 certificate", "ownerId": "meera", "source": "ava", "reason": "The certificate on file expires 8 Dec.", "dependsOn": ["confirm-data"], "status": "todo", "eta": "Tue 17 Nov" }
  ],
  "criticalPath": ["security-cert", "approve-infosec", "handoff"],
  "predictedReady": "Tue 17 Nov",
  "predictionReason": "… Based on sample history in this prototype.",
  "changesSinceLast": ["Added: InfoSec review"]
}
```

Known step ids whose status the engine sets: `approve-budget, approve-vp, approve-infosec, competing, dpa, security-cert, insurance, gst, renewal-terms, retro, get-quote, confirm-data, check-nda-msa, resolve-rates, resolve-delivery, resolve-uat, handoff`.

## `POST /api/ava/recommend`

Request: `{ "conflict": Conflict, "request": <request context> }`. Response `AiRec`:

```json
{ "recommendation": "Ask Trivenika to reissue the rate card within the 8% cap; that removes ₹39,200 from this quote.", "reasoning": "MSA 5.3 allows at most 8% over Schedule A, with 60 days' notice.", "citations": [{ "type": "clause", "id": "TV-MSA-2024 5.3" }], "confidence": "high", "draft": "Hi Arjun, …", "action": "draft_supplier" }
```

Actions: `draft_supplier` (Use this creates a draft), `ask_requester` (creates a one-click question), `require_cr` (resolves with a change request), `ask_legal`, `review`.

## `POST /api/extract`

`multipart/form-data` with `file` (PDF or XLSX). Response: `{ "kind": "pdf" | "xlsx" | "other", "pages": string[][], "sheets"?: [{ "name", "rows" }] }`.

## Engine actions (`Action` in `lib/types.ts`)

Dispatched with `useAva().act(action, actor?)`. All are logged.

| Action | Fields | Effect |
|---|---|---|
| `answer_flag` | requestId, flagId, answer yes/no, note? | Answers a question (data access adds a person fact; keep_line records the answer) |
| `dismiss_flag` | requestId, flagId | Marks an info or mention flag as noted |
| `confirm_fact`, `set_fact`, `dispute_fact` | requestId, field, value?, reason? | Person fact events; disputes mention Procurement |
| `resolve_conflict` | conflictId, choice A/B/value/accept, value?, reason? | Resolves; accept records a contract issue |
| `require_cr` | conflictId, note | Resolves a contract conflict; records the note for Legal |
| `ask_legal` | conflictId, text | Mentions Legal |
| `ask_supplier` | requestId, conflictId? | Creates a draft |
| `mark_sent` | draftId | Records the draft as sent in the thread (`sendDraft`) |
| `set_autonomy` | setting `autoSendQuoteRequests`/`autoSendDocChasers`, value | Switches what Ava may send without a click; logged and replayed |
| `rec_use`, `rec_dismiss` | recKey, requestId, draft? / reason | Uses or dismisses a recommendation (human decision) |
| `comment` | requestId, conflictId?, text | Comment with @mentions |
| `rerun` | requestId, emailId?, extraction?, source? | Re-extraction |
| `approve` | requestId, key budget_owner/vp/infosec | Adds a receipt with the current snapshot |
| `send_back` | requestId, key, note | An approver cannot sign yet. Approves and rejects nothing; the approval stays open. Tells the requester and Procurement (a mention item each) and logs it |
| `record_exception` | requestId, kind sole_supplier/retro/other, reason | Exception |
| `competing_quote` | requestId, note | Competing quote |
| `reassign` | itemKey, to | Reassigns an item |
| `escalate` | conflictId | Escalates to the VP |
| `orphan_confirm`, `orphan_not_mine` | orphanId | Orphan invoice handling |
| `add_supplier` | requestId | Adds a new supplier |
| `tick` | | Advances the clock |

## Events (`AvaEvent`)

```ts
{ id, at, kind: "email", email, extraction, extractionSource: "live" | "cached" | "basic" | "none", tag? }
{ id, at, kind: "action", actor, action, tag? }
{ id, at, kind: "ai", requestId, layer: "read" | "plan" | "rec", key, output, source: "live" | "cached" | "rules", tag? }
```

## Ask Ava and metrics (library functions)

| Function | File | What |
|---|---|---|
| `parseIntake(text, suppliers)` | `lib/intake.ts` | Reads a plain-language need into `IntakeFields` (supplier, contact, project, budget, start, duration, data access, request type). Rules only |
| `buildIntake(fields, requesterId, state)` | `lib/intake.ts` | Returns `{ email, extraction }`: an `Email` with `origin: "intake"` to `ava@prayaan.example`, and an `Extraction` whose facts quote the text |
| `previewIntake(state, fields, requesterId)` | `lib/intake.ts` | Runs the event on a copy of the state; returns approvers, rules, end state, 90-day total, the first message and whether it auto-sends, and any duplicate. Saves nothing |
| `waitSplit(state, reqId)` | `lib/engine/timing.ts` | `{ total, supplier, own, ownMet }` in hours: the supplier's wait against Prayaan's own time |
| `northStar(state)` | `lib/insights.ts` | Per-request rows and totals: good (ready, never withdrawn, own time under 1 day), touches per request, approvals reopened, auto-sent messages, started in Ask Ava, clean first passes |
| `timeLine(state, reqId)` | `lib/summary.ts` | The sentence "N business days on the calendar. Prayaan's own time: … The rest, …, was waiting on the supplier." |
| `rippleBetween(prev, next, actor, label, n)` | `lib/store.ts` | Who a change reached: per person, the items opened and closed |

## Types added

- `EmailOrigin` adds `"intake"`. `Email.autoSent?: boolean` marks a routine message Ava sent.
- `Extraction.supplierContact?: string`: the supplier contact named in Ask Ava.
- `State.autonomy: Autonomy` where `Autonomy = { autoSendQuoteRequests: boolean; autoSendDocChasers: boolean }`.

