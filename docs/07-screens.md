# 07 Screens

Writing rules for all UI copy: plain words, short sentences, names, numbers and dates; no paragraph over 3 sentences; no banned words. One date format (`Thu 12 Nov, 10:12`). Rupees: full Indian format for exact amounts (₹21,10,800), short lakh form for totals (₹39.11L).

## App shell (`components/Shell.tsx`)

- **Sidebar**: Captured mail · Today · Requests · Dashboard, then "About the case" with the six numbered case pages and reading time, then Settings. Live counts on Today. Collapses to an icon rail at tablet width and a drawer on mobile.
- **Top bar**: "Prayaan Software (fictional) · supplier email is simulated", the simulated clock (click for details), a bell with the viewer's item count (links to Today), and **View as** (person switcher with roles).
- **Guided demo dock** (bottom): scenario tabs A and B, step number, time, progress dots, caption, "Show me where this happened →", Back, Next/Start. Secondary buttons: **Test lab: simulate an incoming email**, **Show a repeat request**, Reset (with confirm), minimise. After each step the app navigates to the step's focus URL, scrolls to the changed element and pulses it for 2 seconds; some steps open the source viewer (A6: v1 beside v2; B1: the three order-form lines). When a step acts as another person, a toast says "Now acting as …" with a "Switch view to …" button.
- **Source viewer** (`SourceViewer.tsx`): modal showing the email text, or an attachment's text by page with highlighted quotes, or v1 beside v2 with new lines marked, or a **contract PDF at a clause** with the clause highlighted. "Original file" tab shows the real PDF or the XLSX sheets.

## Landing (`/`)

- Headline: "Supplier email in. Routed request out."
- Subhead: "Ava reads every supplier email, plans the work, does the legwork, and tells each person the one decision that needs them."
- Trust line: every fact links to the sentence it came from; Ava only receives supplier email, through a mail rule IT controls.
- Four tabs, each a real screenshot (`public/screens/`) and one sentence: **Reads** (Ava's read of REQ-1047), **Plans** (the plan with predicted date and critical path), **Acts** (the "Ava did N / people decided M" banner), **Advises** (the ₹1.5L UAT recommendation).
- Buttons: Watch Scenario A (3 min), Watch Scenario B (2 min), or test with your own email.
- Counters row: emails recorded, requests, open items, ready, Ava actions : people decisions, contract terms checked, 0 forms filled.

## Captured mail (`/mail`, was Inbox)

Intro: "Supplier email Ava received through the mail rule. Simulated here." Header button: "Test lab: simulate an incoming email".

- Left: mailbox list with person filters (All, Rahul, Neha, Suresh), attachment chips, "Sent from Ava's draft" and "Composed" tags.
- Middle: the email with attachment buttons, or "See it as Rahul does in Outlook" (a mail client view with a narrow Ava add-in showing the request, status and what waits on that person, with Yes/No, Noted and Send draft).
- Right, **Ava recorded** panel, top to bottom:
  1. Ava's one-line read of the request (cited, labelled)
  2. **What changed** banner (e.g. "Price changed in the attachment: ₹20,00,000 → ₹21,50,000 (+₹1,50,000). The email body says nothing about price.") with "See the line in the PDF" and "Open the conflict"; green "Resolved" banner when an email closes a conflict
  3. **Checked against the contracts**: ✓, ✗ or • per check, each with a clause link
  4. Needs attention: conflicts opened and flags raised by this email, and who they went to
  5. Filed under: Supplier › Project › REQ, filing confidence, current status
  6. Facts (collapsed): each field with its request-level state, who confirmed it, and its source
- **Test lab composer**: title "Test lab: simulate an incoming email", note "In real use, these emails come from Outlook or Gmail through a mail rule." Fields: From (anyone), reply in thread, To, Cc, Subject, Body, attachments (upload PDF or XLSX, read on the server; or pick sample files). Button: **Simulate email arriving**. Extraction is Live AI with a key, otherwise basic.
- **Try this**: five pre-filled emails with what to expect (see [06](06-scenarios.md)).

## Today (`/today`, was My work)

Person tabs with counts (Procurement, InfoSec, Finance, Legal, three budget owners, VP, two requesters). For the selected person:

- **Needs your decision**: decision cards (`ItemCard`) for engine items, each with the question, evidence quote, draft, **Ava recommends** (where one applies), and actions (Yes/No, Keep it/Remove it with a note, Review and approve/reconfirm with the Decision Receipt, Record exception, Attach competing quote, Record reason, Confirm/Not mine for orphan invoices, Ask a question, Reassign). Background decisions appear as cards with cached recommendations, marked outside the guided demo.
- **Coming up**: the person's open steps from every plan (live and background), with dates.
- **Since yesterday, Ava handled X things for you**: Ava's actions in the last 36 hours on requests the person is involved in, plus background actions tagged for them. Show all.
- My requests (for requesters), Procurement summary (requests, open conflicts including background, exceptions, unsorted), Legal's handoff packets and withdrawn packets.

## Requests (`/requests`)

All live and background requests. Filters: All, Has open conflict. Group: List or By supplier. Columns: request (with Scenario A / B / Contrast / Background tag), supplier › project, requester and cost centre, value, 90-day total (computed for background too), routing chips, status, waiting on (a named person), opened ("opened 16 h ago", "opened just now"). Background ids link to the background request view.

## Request page (`/requests/[id]`): the case file

Order, top to bottom:

1. **Header** (sticky): breadcrumb, id and title, status chip, "Started before approval" chip, one generated summary sentence, and the intake stepper (Captured, Facts, Checks, Approvals, Legal Review or Issue PO). Then supplier, value, 90-day total (red over the limit), requester, owner, first email.
2. **Status banner**: red "Handoff blocked: …" with reasons, or green "Ready for Legal Review. The handoff packet went to Farah Khan. Ava did N actions; people made M decisions." with timing and the prediction line.
3. **Ava's read**: cited sentences, label, "Updated … · see previous".
4. **Needs you**: the viewer's items for this request (recommendations read-only here), and chips for what waits on others.
5. **Ava's plan**: steps, badges, critical path, predicted date and reason, What changed.
6. **Problems Ava found**: open conflict cards with Ava recommends; resolved ones collapsed; drafts for the requester collapsed.
7. **What the contract says about this deal**: 3 to 5 clauses with status.
8. **Ava did**: collapsed log with count.
9. **Tabs**: Facts · Documents · Approvals (approvals, checklist, "Why these approvers?" routing drawer) · Timeline · Handoff packet (when ready).

### Conflict card (`ConflictCard.tsx`)

Type chip (Said vs written, Hidden scope or data access, Renewal terms changed, Started before approval, Goes against the contract), severity, status, escalated; title; impact ("Computed by code from the clause"); opened and age. Sections: 1 What conflicts (source A and B quotes, each with a source link: email, attachment line or clause), 2 Why it matters, 3 Who resolves it, 4 What is blocked, waiting on supplier, **Ava recommends**, 5 Actions (see [03](03-policy-rules.md)), drafts, comments with @mentions, 6 After resolution.

### Decision Receipt (`ReceiptModal` in `request.tsx`)

Opens with **Ava's summary for you** (3 bullets) when present. Then Needs reconfirmation (given for vs current, and the source line), You are approving (amount, scope, term, 90-day total, data access, document versions), what Ava checked, what nobody checked (clause wording, supplier MSA comments, DPA terms, value for money), exceptions, Approve/Reconfirm (only the named approver can act; others get "View as …").

### Handoff packet

Ava's final read and the action/decision counts; contract issues raised at intake; contract issues resolved during intake; confirmed facts with sources; proposed terms (marked Proposed); existing agreement; signed receipts; exceptions; items assigned to Legal review; open notes; documents with superseded versions. Download as JSON.

### Background request view

Read, plan, conflict with recommendation, Ava did, all labelled Cached and "outside the guided demo".

## Dashboard (`/dashboard`)

1. **At risk**: live requests whose plan date is after the 1-business-day target or whose handoff is blocked, and background requests with a risk; each with the predicted date and reason. Fresh session: REQ-1029 and REQ-1032.
2. **Ava caught this**: catches with ₹ or risk impact from open and resolved conflicts, live and background, largest first (₹5.6L Codehive, ₹3.1L Rangmanch, ₹2.8L Pixelwise, TalentBridge risk on a fresh session; ₹1,50,000 UAT line, ₹90,000 credit, ₹39,200 rates, ₹1,26,000 a year saved on Kosha as the scenarios run).
3. **Counters**: ₹ at stake caught, Ava actions vs people decisions, contract terms checked, Forms filled 0. Second row: requests captured, questions answered from documents, approvals reopened, started before approval.
4. **Pipeline / Conflicts** tabs: 5 columns (New, Waiting on someone, Approvals, Blocked, Ready) with live and background cards; conflicts table including background.
5. Timing, Changes feed, Invoices with no request.

## Conflicts (`/conflicts`)

Table of every conflict (live and background), then the full cards: open or all, plus background cards with their recommendation.

## Suppliers (`/suppliers`, `/suppliers/[id]`)

Supplier page: **Commitments** (commitment · value · clause link · next date, supplier history), 90-day spend by cost centre, contacts, projects, requests, documents and expiry dates (contract ids open the PDF).

## Case pages (`/story/[slug]`)

Six short pages, each opening with the question it answers and a one-line answer, then evidence; demo references are buttons that replay the engine to that step.

| Slug | Title | Content |
|---|---|---|
| why | Why intake | Lifecycle strip; five downstream failures traced back to what intake missed; the two end states |
| problem | The problem | Sourced stat cards; who it hurts and what it costs; three testable hypotheses |
| stakeholders | Stakeholders | Speed-versus-control spectrum; wants, worries, gets per stakeholder; conflict pairs; how one action ripples across screens |
| metrics | Metrics | North star: share of supplier requests complete and correctly routed within one business day of the first email (live value); supporting metrics; tripwires |
| assumptions | Assumptions | Policy table; each assumption with "if this is wrong"; how Ava connects |
| sirion | Ava and Sirion | Ava as the front door before a contract exists; fit diagram; sourced comparison |

## Settings (`/settings`)

Illustrative, not enforced: how Ava connects (mail rule diagram), scope, exclusions (HR, Board, Outside counsel), attachment types, retention (7 years with the request; unfiled mail 30 days), transparency toggle.
