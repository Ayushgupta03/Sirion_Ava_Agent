# 03 Policy rules

The AI extracts facts. Code applies policy. Every routing decision shows the rule that triggered it. All of this lives in `lib/engine/rules.ts` (`analyze`) and is run after every event by `runRules` in `lib/engine/pipeline.ts`.

## The 11 rules from the brief

1. **Approval limit.** Cumulative spend before GST, per supplier and cost centre, over a rolling 90 days. Above ₹25,00,000 needs VP approval. Budget owner approval is always required.
2. **Competing quote.** Above the same limit, Procurement attaches a competing quote or records an authorized exception (reason plus VP approval).
3. **Data access.** If the supplier will access personal or customer data, InfoSec approval and a DPA are required. In intake, the DPA is assigned to Legal review.
4. **Checklist by contract type and risk.** For an IT services consultant with customer data access: NDA (Legal), DPA (Legal review), security certificate in date (InfoSec), insurance certificate (Procurement), GST and PAN (Finance), budget approval at the current amount, VP approval if over the limit, competing quote or exception if over the limit.
5. **Material facts.** Amount, scope, data access, term, supplier entity. When one changes, every approval that depended on it is marked Needs reconfirmation, routing is recalculated, and handoff is blocked.
6. **Fact states.** Missing, Unconfirmed, Contradicted, Confirmed. Ava never silently picks between conflicting sources.
7. **Supersession.** A newer document from the same supplier on the same request replaces the old value for the fields it covers. The old version is kept and shown side by side.
8. **Intake is complete when** no required fact is missing, unconfirmed or contradicted; every checklist item is done, excepted or assigned to Legal review; every approval is signed against current facts; the supplier is known.
9. **Two end states.** Ready for Legal Review (new agreements, data access, non-standard terms) or Ready to issue PO (repeat work under an existing MSA, no data access, within limits; only the budget owner approves).
10. **Ava's limits.** Never emails suppliers (drafts only). Never approves or rejects. Checks that documents are present and in date. Revision 3 adds checks of contract **commitments** (values, dates, caps); Ava still does not review clause wording, which stays with Legal.
11. **Who gets a flag.** Whoever can fix it: missing facts to the requester, security to InfoSec, agreements to Legal, tax to Finance, quotes and exceptions to Procurement. Procurement owns the whole request.

## 90-day spend (`computeCumulativeSpend`)

Adds signed SOWs and subscriptions for the same supplier and cost centre dated within 90 days, plus every request in the session for the same pair (the current one marked "this request"). Output: lines, total, `overLimit`, window start, and text like `₹9L + ₹9L + ₹20L = ₹38L`.

Examples from the scenarios:

| Moment | Lines | Total |
|---|---|---|
| Scenario A step 2 | SOW-0412 ₹9L + SOW-0438 ₹9L + REQ-1047 ₹20L | ₹38L |
| Scenario A step 6 | … + REQ-1047 ₹21.5L | ₹39.5L |
| Scenario A step 8 | … + REQ-1047 ₹21,10,800 | ₹39,10,800 |
| Scenario B step 5 | Renewal ₹18,90,000 + Forecast module invoice | ₹21.3L |

## Routing (`computeRouting`)

| Rule id | Title | Fires when | Result |
|---|---|---|---|
| R1b | Budget owner | Always | Budget owner of the cost centre approves |
| R1 | Approval limit | 90-day total over ₹25L | VP approval |
| R2 | Competing quote | Over ₹25L | Competing quote or exception |
| R3 | Data access | Supplier will access customer data, confirmed by the requester | InfoSec approval, DPA to Legal review |
| R9 | End state | Always | Legal review if data access, no MSA, supplier comments on terms, or over the limit; otherwise PO |

Data access mentioned by the supplier but not confirmed by the requester does not route yet: it raises a one-click question to the requester and a "hidden scope" conflict.

## Checklist

Built per request by `analyze`. Items: Signed NDA; Master agreement in place; DPA (Legal review) and security certificate and insurance when data access is confirmed; GST and PAN; budget approval at the current amount; VP approval and competing quote/exception when over the limit; renewal terms match what was agreed (renewals); reason and retrospective approval for work started early. Each item records how it was closed ("how each item was closed"), and the closure is logged once.

The security certificate must be valid past the engagement end (start date + duration). Trivenika's certificate on file expires 8 Dec 2026, before the migration ends, so InfoSec waits for the renewed one.

## Approvals and Decision Receipts

Each approval stores receipts. A receipt records who approved, when, and a **snapshot** of the facts approved:

| Approval | Snapshot |
|---|---|
| Budget owner | amount, started-before-approval amount, term, supplier entity |
| VP | 90-day total, exceptions recorded |
| InfoSec | data access, scope |

`approvalStatus` compares the last receipt's snapshot with current facts:

- No receipt: Pending.
- Differences: **Needs reconfirmation**, with "Given for X. Current: Y." lines and the source line in the new PDF.
- Otherwise Approved or Reconfirmed.

**Decrease rule (revision 3):** for amount, 90-day total and started-before-approval amount, only an **increase** reopens an approval. A lower price never forces a re-approval. Test: approving ₹21.5L / ₹39.5L, then seeing ₹21,10,800 / ₹39,10,800, stays Approved.

Approvers are not asked while renewal terms are in dispute (the gate is closed until the renewal conflict is resolved). Approval gates also wait until the amount is confirmed by a document and the data access question is answered.

When an approval reopens, the change feed records which approvals reopened, the "approvals reopened" counter goes up, and if the request was already Ready for Legal Review it is **withdrawn** and Farah gets a mention.

## Conflicts (detected by code, resolved by people)

| Type | Label | When | Owner |
|---|---|---|---|
| `said_vs_written` (amount) | Said vs written | The amount in a document differs from what was said or approved, and is not a decrease below an approval. The id is stable per approval count, so a later quote updates the same open card. Impact: the sum of new ₹ lines (₹1,50,000 in Scenario A). | Karan |
| `said_vs_written` (other fields) | Said vs written | A person's confirmation disagrees with a newer document (data access, duration, scope) | Karan |
| `hidden_scope` | Hidden scope or data access | The supplier mentions customer data; the request did not | The requester |
| `renewal_terms_changed` | Renewal terms changed | The order form changes fee, term or auto-renewal while the email says nothing changes. Revision 3 adds the clauses it breaks (KA-MSA-2025 4.2, 4.3) to source A. | Karan |
| `started_before_approval` | Started before approval | An invoice arrives for unapproved work, or the supplier says work has started | Karan |
| `against_contract` | Goes against the contract | `checkCommitments` finds a breach (rates over the cap, late delivery). Impact computed from the clause. | Karan |

A conflict closes automatically when the sources agree again (with a specific resolution text, e.g. "Rates now within the 8% cap: ₹39,200 over-charge removed."), or a person resolves it.

Conflict actions on the card:

| Action | Effect |
|---|---|
| Accept source A / B / Enter the correct value | Not shown for contract conflicts. Records the choice; may add a person fact event. |
| Accept with a reason | Resolves, records a contract issue for the handoff packet |
| Ask the supplier | Ava drafts a message for a person to send |
| Ask Legal | Mentions Farah with the question |
| Require a change request | Contract conflicts only. Resolves, records the note (e.g. the ₹90,000 credit) as a contract issue for Legal |
| Comment | With @mentions, which become items |
| Re-run Ava | Re-extracts the latest email with attachments (live or basic) |
| Escalate | Marks it escalated to the VP |

Every conflict card also has an **Ava recommends** box (see [05](05-ai-layers.md)).

## Flags and drafts

Flags: data access question (to the requester), start date within 7 days (info), certificate expiring within 60 days (InfoSec), and AI-raised flags the code does not already cover. The revision 3 one-click question (`keep_line`, e.g. "Keep UAT in scope?") is a stored flag that only closes when answered.

Drafts: when checklist items wait on the supplier (insurance, renewed ISO certificate), Ava drafts one email for the requester. "Ask the supplier" and recommendations create drafts too. Ava never sends; a person marks a draft as sent, which records it in the thread and starts the "waiting on supplier" clock.

## Handoff (`computeHandoffState`)

Reasons collected: missing, unconfirmed or contradicted facts; open checklist items; pending or stale approvals; open blocking conflicts; unknown supplier. If any approval is stale or any blocking conflict is open: **Blocked**, with a banner ("Handoff blocked: 2 approvals do not match current facts."). Other reasons: In progress. None: Ready (Legal or PO per R9). When Ready is reached the time is recorded and a handoff packet is generated.

The plan never overrides this. The rules engine stays the source of truth for whether handoff is allowed.

## Timing (`lib/engine/timing.ts`)

Business days from the first email to Ready, against a 1-business-day target, and the longest wait with whom it was waiting on. Supplier waits count only replies on the same thread. Scenario A: 3 business days, longest wait InfoSec waiting on the renewed certificate (Thu 12 Nov 12:05 to Tue 17 Nov 11:05). Scenario B: longest wait Kosha's corrected order form (Mon 23 Nov 10:20 to Tue 1 Dec 14:30).
