# 18 Ask Ava, autonomy and the supplier view

Three additions that move intake earlier and take routine messages off people's hands. All three go through the same pipeline as supplier email: nothing here has its own rules.

## Ask Ava: the front door (`/new`, `lib/intake.ts`)

An employee describes a need in their own words, before anyone has emailed a supplier. Ava turns it into a request, shows what it will need, and (by default) sends the supplier a routine request for a written proposal that says no work starts before a PO.

### Flow

1. **Who is asking.** Defaults to the current "View as" person if they have a cost centre, otherwise Neha. The cost centre comes from the directory.
2. **Describe the need.** Free text, or one of three examples (`EXAMPLES`):
   - Neha: small job under the existing Trivenika agreement, no customer data (ends in Ready to issue PO).
   - Rahul: lead scoring in Salesforce, ₹12L, admin access to customer records (crosses the ₹25L VP limit with earlier SOWs; InfoSec and a DPA).
   - Aditi: a new supplier, Urban Shine Facility Services (goes to Procurement; needs a contact).
3. **Ava reads it** (`parseIntake`). Rules, not a model: supplier (matched against the supplier list, or the capitalised name after "with / from / hire / use…"), budget (`₹6L`, `about 6 lakh`, `Rs 4,00,000`), start ("Monday", "in 3 weeks", "16 Nov"), duration (read from what is left after the start phrase, so "starting in 3 weeks for 6 weeks" gives 6 weeks), data access (explicit "no customer data" wins over any mention of data), request type (renew → renewal, extend → amendment, else new SOW), project (the thing being bought, from the first sentence). A live model can replace this later; the output shape (`IntakeFields`) stays the same.
4. **Confirm the fields.** Every field is editable. Ava lists what is still missing in plain words: which supplier, a rough budget, whether they will touch customer data, a contact at a new supplier. The submit button stays disabled until those are filled.
5. **Preview** (`previewIntake`). The real engine runs on a copy of the state and nothing is saved. It shows: who approves and why, the 90-day total and whether it crosses ₹25L, the rules that fired, the end state, the first message to the supplier (and whether Ava will send it or leave it as a draft), and a duplicate warning if an open request already covers this. It also says the gate in one line: approvers are asked only once the supplier's written quote confirms the amount.
6. **Start the request** (`buildIntake` → `addEmail`). The need becomes an `Email` with `origin: "intake"` sent to `ava@prayaan.example`, plus an `Extraction` built from the confirmed fields. Answers given only in the form (budget, duration, data access, contact) are appended to the body under "Answered in Ask Ava:" so every fact still quotes a sentence.

### What the engine does with it (`ingestIntake` in `lib/engine/pipeline.ts`)

- **Supplier:** matched by domain, then by name. An unknown supplier opens the request with a supplier guess and goes to Procurement ("Add to supplier list"); no message is drafted without a contact.
- **Duplicate check:** an open request with the same supplier, cost centre and an overlapping project gets a note in its log instead of a second request. The preview warns about this before submit.
- **Opening:** `openRequest` (shared with supplier email) assigns the id, links the NDA and MSA on file and any baseline SOW, and logs why. The log says "started this request through Ask Ava, before any supplier email."
- **Facts:** scope confirmed; budget unconfirmed (a person's rough number); duration confirmed unless it says "about"; start date resolved against the simulated clock; data access confirmed either way, because the requester answered it directly.
- **Routing:** the same rules as everything else. Approvers are not asked yet: the approval gate (`gateOpen` in `analyze`) opens only on a confirmed amount that did not come from the requester's own words, so it waits for the supplier's written quote.
- **First message to the supplier** (`draft-rfq-<REQ>`): asks for a written proposal with the price before GST, scope, start date and duration, and the current rate card; when the requester said the work involves customer data, also the current security certificate (ISO 27001 or SOC 2) and insurance certificate; and says "Please do not start work or access any of our systems until you have a purchase order from us." With `autoSendQuoteRequests` on (the default), Ava sends it one minute later in the requester's name and logs it as an Ava action. Otherwise it stays a draft for the requester.
- **The supplier's reply** on that thread lands on the same request like any supplier email, and a written quote confirms the amount.

## Autonomy (`/settings`, `state.autonomy`)

What Ava may do without a click, per kind of message, never per decision.

| Level | Name | What |
|---|---|---|
| 0 | Inform | Ava tells the right person what changed and why |
| 1 | Draft | Ava writes the message or question; a person sends it. The default for everything |
| 2 | Send routine messages | Ava sends it herself, in the requester's name, for message types switched on below. Logged as an Ava action and marked "Sent by Ava, routine" |
| Never | Decide | Approve, reject, resolve a dispute, accept a price, change a term, apply a credit. Always people |

| Switch | Default | Covers |
|---|---|---|
| `autoSendQuoteRequests` | On | The first message from Ask Ava asking for a written proposal. It commits no money and changes no terms |
| `autoSendDocChasers` | Off | Asking a supplier for the insurance or renewed security certificate policy requires. Off so the guided demo still shows the draft path |

Switching one is an engine action (`set_autonomy`), so it is in the event log and replayed like everything else. Auto-sent emails carry `autoSent: true`; `sendDraft` handles both the person and the Ava path. See [ADR 0011](adr/0011-routine-messages-may-be-sent.md).

## Supplier view (`/supplier/[id]`)

What the supplier sees for one request, for the demo. Banner: "Supplier view … Nothing internal is shown: no approvers, no limits, no other suppliers." It lists what Prayaan has asked for (newest first, with "Sent by Ava, routine" on auto-sent messages) and what is still needed (pending insurance or security certificate), and says whether Prayaan is waiting on the supplier.

"Send us a reply" sends as the supplier's first contact: a note, uploaded PDF or XLSX files (read on the server), or a sample document for that supplier. It reaches Prayaan as an ordinary email on the same thread and goes through extraction and the pipeline. The demo dock is hidden on this page.

## Where the time goes (`waitSplit`, `northStar`)

The calendar time of a request mixes Prayaan's work with the supplier's. `waitSplit(state, reqId)` in `lib/engine/timing.ts` splits it:

- **Supplier wait:** every stretch from a message to the supplier to the supplier's next reply (merged where they overlap), plus an unanswered message still waiting at the end.
- **Prayaan's own time:** the rest, from the first message to Ready (or now). `ownMet` is true under 24 hours.

`northStar(state)` in `lib/insights.ts` counts live requests (not invoices, not background samples): a request is **good** when it is Ready, was never withdrawn, and Prayaan's own time was under a day. It also returns touches per request (people decisions ÷ requests), approvals reopened, routine messages Ava sent, requests started in Ask Ava, and clean first passes. See [ADR 0012](adr/0012-north-star-on-own-time.md).

Scenario A takes 3 business days on the calendar, and almost all of it is the supplier: Prayaan's own time is under a day. The status line and handoff banner now say both ("3 business days on the calendar. Prayaan's own time: … The rest, …, was waiting on the supplier.", `timeLine` in `lib/summary.ts`).

## What this reached (ripple)

After any change (a person's action, an email arriving, a guided step, or a change in another window), the app compares every person's open items before and after (`rippleBetween` in `lib/store.ts`) and shows a panel, top right: "What this reached", one row per person whose queue changed ("Meera now has 1 approval", "closed 1 question"), with a button to switch to their view. It closes after 14 seconds. The actor's own row is left out.

**Windows:** the event log is shared by every window of the browser (`localStorage`), and each window follows changes made in another (the `storage` event). "View as" is per window (`sessionStorage`), so two windows can show two people side by side and watch one person's action reach the other.

## Tests

`tests/intake.test.ts` (10): parsing a plain sentence; opening a request before any supplier email; the routine proposal request sent with "do not start"; the draft path when auto-send is off; a supplier reply landing on the same request and confirming the amount; duplicate notes; the preview showing the VP limit and InfoSec while saving nothing; a new supplier going to Procurement with no draft; document chasers staying drafts by default, and sent by Ava (logged as an Ava action) when switched on.

`tests/metrics.test.ts` (3): Scenario A's time is mostly the supplier's; Scenario B's long wait is the corrected order form; a request is good only when ready, never withdrawn and under a day of Prayaan's time.
