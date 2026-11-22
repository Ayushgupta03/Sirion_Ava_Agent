# 07 Screens

Writing rules for all UI copy: plain words, short sentences, names, numbers and dates; no paragraph over 3 sentences; no banned words. One date format (`Thu 12 Nov, 10:12`). Rupees: full Indian format for exact amounts (₹21,10,800), short lakh form for totals (₹39.11L).

## App shell (`components/Shell.tsx`)

- **Sidebar**: Ask Ava · Captured mail · Today · Requests · Dashboard, then "About the case" with the six numbered case pages and reading time, then Settings. Live counts on Today. Collapses to an icon rail at tablet width and a drawer on mobile.
- **Top bar**: "Prayaan Software (fictional) · supplier email is simulated", the simulated clock (click for details), a bell with the viewer's item count (links to Today), and **View as** (person switcher with roles).
- **Demo bar** (bottom; hidden on the landing page until a demo starts, and on the supplier view; a pill on phones): scenario button that opens the step outline, step count and time, clickable progress segments, the step title, a Tips switch, a tools menu (Test lab, Show a repeat request, Replay the orientation, Minimise, Reset demo with confirm), Back and Next. → and ← move between steps. After each step the app navigates to the step's focus URL, scrolls to the changed element and pulses it; some steps open the source viewer (A6: v1 beside v2; B1: the three order-form lines). The last step's button reads "What this proved".
- **Coach card** (floating, above the bar): for the current step, what to notice, why it matters, who it was done as and who it reached. A steady ring and a "Look here" pin mark the element. Replaces the two toasts while it shows. See [20](20-guided-demo.md).
- **Help** (top bar): this page's purpose and tips, six "Try it yourself" tasks ticked from the event log, glossary, shortcuts, replay of the orientation.
- **Orientation** (first demo start only): four spotlight stops: demo bar, clock, View as, Help.
- **Debrief** (end of a scenario): outcome, calendar time against Prayaan's own time and the supplier's wait, what Ava caught, four next actions.
- **Page tips**: a one-time note the first time each page is opened.
- **What this reached** (top right, below the actor toast; folded into the coach card during guided steps): after any action, email, guided step or change in another window, one row per person whose open items changed ("Meera now has 1 approval", "closed 1 question") with a button to switch to their view. Closes after 14 seconds. See [18](18-ask-ava.md#what-this-reached-ripple).
- **Windows**: every window of the browser shares the event log and follows changes made in another; "View as" is per window, so two windows can show two people side by side.
- **Source viewer** (`SourceViewer.tsx`): modal showing the email text, or an attachment's text by page with highlighted quotes, or v1 beside v2 with new lines marked, or a **contract PDF at a clause** with the clause highlighted. "Original file" tab shows the real PDF or the XLSX sheets.

## Landing (`/`)

- Headline: "Supplier email in. Routed request out."
- Subhead: "Ava reads every supplier email, plans the work, does the legwork, and tells each person the one decision that needs them. Or start earlier: tell Ava what you need in a sentence, before the supplier hears from anyone."
- Returning visitor: when the saved session is mid-demo on the first landing visit of a browser session, an amber note says "You left Scenario A at step N. Your session was saved." with buttons to resume or start clean.
- Buttons, directly under the subhead: Watch Scenario A (3 min, primary) and Watch Scenario B (2 min), each with a one-line promise under it, then "Start a request in Ask Ava" and "Or test it with your own email".
- Trust line: every fact links to the sentence it came from; Ava reads only supplier email, through a mail rule IT controls, sends only the routine messages you switch on, and never approves.
- Four tabs (arrow keys, Home and End move between them), each one sentence, a link to the live screen ("See it on request REQ-1047", "See it on Karan's Today page") and a full-width screenshot (`public/screens/`, capped at 520 px tall): **Reads** (Ava's read of REQ-1047), **Plans** (the plan with predicted date and critical path), **Acts** (the "Ava did N / people decided M" banner), **Advises** (the ₹1.5L UAT recommendation).
- Counters row: "This session:" emails recorded, requests, open items, ready, 0 forms filled; then "Including sample requests from other teams:" Ava actions, people decisions, contract terms checked (these include the background requests).

## Ask Ava (`/new`)

The front door: an employee describes a need before any supplier email exists. Full behaviour in [18](18-ask-ava.md).

- **Who is asking** (person with a cost centre) and a text box, with three example chips (small job under an existing agreement; crosses the VP limit with customer data; new supplier).
- **What Ava understood**: editable fields (supplier, contact for a new supplier, project, rough budget, start, duration, data access yes/no/not sure, request type), and a plain list of what is still missing.
- **What this request will need**, computed by the real engine and not saved: approvers and why, 90-day total against ₹25L, rules that fired, end state, the first message to the supplier and whether Ava sends it, a duplicate warning, and the line "Approvers are asked once the supplier's written quote confirms the amount."
- **Start the request** (disabled until supplier, project, budget, data access and, for a new supplier, a contact are filled), then a link to the new request.

## Captured mail (`/mail`, was Inbox)

Intro: "Supplier email Ava received through the mail rule. Simulated here." Header button: "Test lab: simulate an incoming email".

- The email body shows what the sender wrote this time. Quoted earlier messages fold under "Earlier messages in this thread · Ava ignores quoted text".
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

- **Needs your decision**: sorted by due date, so overdue items come first and say "N days overdue" in red. The first card is tagged "Do this first". Cards for the same request sit under one heading ("REQ-1047 · … 4 decisions on this request"). Decision cards (`ItemCard`) for engine items, each with the question, evidence quote, draft, **Ava recommends** (where one applies), and actions (Yes/No, Keep it/Remove it with a note, Review and approve/reconfirm with the Decision Receipt, Record exception, Attach competing quote, Record reason, Confirm/Not mine for orphan invoices, Ask a question, Reassign). Background decisions appear as cards with cached recommendations, marked outside the guided demo.
- **Coming up**: the person's open steps from every plan (live and background), with dates.
- **Since yesterday, Ava handled X things for you**: Ava's actions in the last 36 hours on requests the person is involved in, plus background actions tagged for them. Collapsed to its heading when there are more than three; Show all.
- My requests (for requesters), Procurement summary (requests, open conflicts including background, exceptions, unsorted), Legal's handoff packets and withdrawn packets.

## Requests (`/requests`)

**Table** or **Board** (the same board as the Dashboard). Table: all live and background requests. Filters: All, Has open conflict. Group: List or By supplier. Columns: request (with Scenario A / B / Contrast / Background tag), supplier › project, requester and cost centre, value, 90-day total (computed for background too), routing chips, status, waiting on (a named person), opened ("opened 16 h ago", "opened just now"). Background ids link to the background request view.

## Request page (`/requests/[id]`): the case file

Header on every tab (sticky from tablet width up; scrolls away on phones): breadcrumb, id and title, status chip, "Started before approval" chip, the intake stepper (Captured, Facts, Checks, Approvals, Legal Review or Issue PO; each pill opens the tab that holds it and scrolls to it), then the tab bar. Tabs: **Overview** · **Problems** (red count of open ones) · **Plan** · **Contract** · **Facts** · **Documents** · **Approvals** (red count of reopened) · **Timeline** · **Handoff packet** (when ready). Every `#anchor` (`#read`, `#plan`, `#conflicts`, `#contract`, `#packet`, `#cf-…` and the rest) and every guided-demo pulse target opens its tab first (`HASH_TAB` and `PULSE_TAB` in `app/requests/[id]/page.tsx`).

**Overview**
1. One summary sentence (when the request is not blocked), then supplier, value, 90-day total (red over the limit), requester, owner, first email.
2. **Status banner**: red "Handoff blocked: …" with reasons, who it is waiting on, and a "Resolve N problems" button; or green "Ready for Legal Review. The handoff packet went to Farah Khan. Ava did N actions; people made M decisions." with timing, the prediction line and an "Open the handoff packet" button.
3. **Ava's read**: cited sentences, label, "Updated … · see previous".
4. **Needs you**: the viewer's items for this request, and chips for what waits on others. A conflict item here links to its conflict card instead of repeating Ava's recommendation; other items show it read-only.
5. **Open problems**: one line each with severity and impact, and "See all and resolve →".
6. **Ava did**: collapsed log with count.

**Problems**: open conflict cards with Ava recommends; resolved ones collapsed; drafts for the requester collapsed. **Plan**: steps, badges, critical path, predicted date and reason, What changed, and a "Re-planning…" note while a live plan refreshes. Once more than two steps are done, finished steps fold away behind a "Show N finished steps" link. **Contract**: what the contract says about this deal, 3 to 5 clauses with status. **Facts**, **Documents**, **Approvals** (approvals, checklist, "Why these approvers?" routing drawer) and **Timeline** as before; **Handoff packet** appears when ready.

### Conflict card (`ConflictCard.tsx`)

Type chip (Said vs written, Hidden scope or data access, Renewal terms changed, Started before approval, Goes against the contract), severity, status, escalated; title; impact ("Computed by code from the clause"); opened and age. Sections: 1 What conflicts (source A and B quotes, each with a source link: email, attachment line or clause), 2 Why it matters, 3 Who resolves it, 4 What is blocked, waiting on supplier, **Ava recommends**, 5 **Resolve it** (see [03](03-policy-rules.md)): **Decide it** ("Go with what Rahul said: ₹20L", "Go with what Trivenika wrote: ₹21,10,800", "Enter a different value", "Accept with a reason"; for contract conflicts "Accept with a reason" and "Require a change request"), **Get input first** (Ask the supplier, Ask Legal, Comment) and **More** (Re-run Ava, Escalate), drafts, comments with @mentions, 6 After resolution.

### Decision Receipt (`ReceiptModal` in `request.tsx`)

Opens with **Ava's summary for you** (3 bullets) when present. Then Needs reconfirmation (given for vs current, and the source line), You are approving (amount, scope, term, 90-day total, data access, document versions), what Ava checked, what nobody checked (clause wording, supplier MSA comments, DPA terms, value for money), exceptions, then **Approve/Reconfirm** and **Send back with a note** (only the named approver can act; others get "View as …"). Send back asks for a reason, approves and rejects nothing, leaves the approval open, and puts a mention item on the requester's and Karan's Today. The header and action bar stay fixed; only the body scrolls. Scope and other values are shown in full: wrapped PDF lines are rejoined at extraction (`lib/joinLines.ts`).

### Drafts

Each draft box says who it is for. A draft Ava sent herself under the autonomy settings reads "Ava sent this for <person>: a routine message, switched on in Settings."

### Handoff packet

Ava's final read and the action/decision counts; contract issues raised at intake; contract issues resolved during intake; confirmed facts with sources; proposed terms (marked Proposed); existing agreement; signed receipts; exceptions; items assigned to Legal review; open notes; documents with superseded versions. Download as JSON.

### Background request view

Read, plan, conflict with recommendation, Ava did, all labelled Cached and "outside the guided demo".

## Dashboard (`/dashboard`)

1. **At risk**: live requests whose plan date is after the 1-business-day target or whose handoff is blocked, and background requests with a risk; each with the predicted date and reason. Fresh session: REQ-1029 and REQ-1032.
2. **Ava caught this**: catches with ₹ or risk impact from open and resolved conflicts, live and background, largest first (₹5.6L Codehive, ₹3.1L Rangmanch, ₹2.8L Pixelwise, TalentBridge risk on a fresh session; ₹1,50,000 UAT line, ₹90,000 credit, ₹39,200 rates, ₹1,26,000 a year saved on Kosha as the scenarios run).
3. **Counters**: ₹ at stake caught, Touches per request (people decisions per request; lower is better), Started in Ask Ava, Clean and fast (the north star: complete, never withdrawn, Prayaan's time under 1 day). Second row: requests captured from email, questions answered from documents, approvals reopened by changed facts, started before approval. Below: one line of activity for context, not success (Ava actions, people decisions, contract terms checked).
4. **Pipeline / Conflicts** tabs, at the top of the page. The pipeline is the **board** (also on the Requests page as "Board"): New, Waiting on others, Approvals, Blocked, Ready, each with a one-line meaning. A card shows who the next step is with, open conflicts and routing chips. Filters: Everything or Waiting on me, and sample requests from other teams (on by default, remembered). **Click a card** for a drawer: why it is in its column, who has the next step, open conflicts, a "Hand over" menu for the viewer's own items, and "Open REQ-…". **Drag a card**: a stage cannot be moved by hand, because the rules work it out from facts, approvals and conflicts, so dropping on a column explains why the request stays and what it needs (`whyNotMove`, `lib/board.ts`). Dropping on a person in the strip that appears hands over what is waiting on you on that request (the `reassign` action). On a phone, a stage switcher shows one column at a time. Conflicts: table including background.
5. **Ava's advice** and **Predicted dates** cards. Advice: used, edited, dismissed and still open, by confidence, with the reasons people gave for dismissing. Dates: for each request that reached Ready, what its first plan predicted, what its final plan predicted, and the real date, in business days; "within a day" is one business day or less, and misses are shown on purpose.
6. Timing (first message to Ready, split into the supplier's wait and Prayaan's own time; open requests show Prayaan's hours so far), Changes feed, Invoices with no request.

## Conflicts (`/conflicts`)

Table of every conflict (live and background), then the full cards: open or all, plus background cards with their recommendation.

## Suppliers (`/suppliers`, `/suppliers/[id]`)

Supplier page: **Commitments** (commitment · value · clause link · next date, supplier history), 90-day spend by cost centre, contacts, projects, requests, documents and expiry dates (contract ids open the PDF).

## Supplier view (`/supplier/[id]`)

What the supplier sees for one request: what Prayaan has asked for (auto-sent messages marked "Sent by Ava, routine"), what is still needed, whether Prayaan is waiting on them, and "Send us a reply" (note, PDF or XLSX upload, or a sample document) that arrives as an email on the same thread. Banner: nothing internal is shown. No demo dock.

## Case pages (`/story/[slug]`)

Six short pages, each opening with the question it answers and a one-line answer, then evidence; demo references are buttons that replay the engine to that step.

| Slug | Title | Content |
|---|---|---|
| why | Why intake | Lifecycle strip; five downstream failures traced back to what intake missed; the two end states |
| problem | The problem | Sourced stat cards; who it hurts and what it costs; three testable hypotheses |
| stakeholders | Stakeholders | Speed-versus-control spectrum; wants, worries, gets per stakeholder; conflict pairs; how one action ripples across screens |
| metrics | Metrics | North star: requests that reach Ready complete, correctly routed, never withdrawn, with Prayaan's own time under 1 day (live value); where the time goes (supplier wait vs Prayaan's time, as a bar); drivers (touches per request, rework avoided, clean first pass, started in Ask Ava, routine messages sent, filing accuracy); week-1 baseline plan; tripwires |
| assumptions | Assumptions | Policy table; each assumption with "if this is wrong"; how Ava connects |
| sirion | Ava and Sirion | Ava as the front door before a contract exists; fit diagram; sourced comparison |

## Settings (`/settings`)

**What Ava may do without a click** (enforced by the engine): the autonomy ladder (Level 0 Inform, Level 1 Draft, Level 2 Send routine messages, Never: Decide) and two switches, Quote requests from Ask Ava (on) and Document chasers (off). Each switch is a logged action. The rest is illustrative, not enforced: how Ava connects (mail rule diagram), scope, exclusions (HR, Board, Outside counsel), attachment types, retention (7 years with the request; unfiled mail 30 days), transparency toggle.
