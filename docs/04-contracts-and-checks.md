# 04 Contracts and contract checks

Added in revision 3 (Parts 1 and 2). Ava checks every email against what is signed. Consequences in rupees and days are computed by code from the clause, never by the AI.

## Contracts as real documents

- Source of truth: `data/contracts.json` → `docs[]`, each `{docId, supplierId, title, parties, signed, fees?, clauses[], schedule?}`. Each clause is `{clause, title, text, kind?, due?, value?, keywords?}`.
- `scripts/make-samples.ts` renders every doc to `public/samples/contracts/<docId>.pdf` with `pdf-lib` (numbered clauses, Schedule A as a table, "Signed 2 Apr 2024" in a readable date). It also writes each PDF's text into `data/sample-texts.json` so the viewer can highlight a clause.
- `lib/engine/contracts.ts` exposes `CONTRACT_DOCS`, `contractDoc`, `clauseOf`, `clauseQuote` (`"<clause> <title>. <text>"`), `clauseSource` (a `Source` with `docId` and `clause`), `docsFor(supplierId)` and `SUPPLIER_HISTORY`.

### Clause kinds used by the checks

| kind | Meaning | Example |
|---|---|---|
| `term` | Term end date | KA-MSA-2025 2, due 31 Dec 2026 |
| `auto_renew` | Auto-renewal with notice | TV-MSA-2024 2.2 |
| `delay_notice` | Notice of delay | TV-MSA-2024 4.2, 10 business days |
| `rate_cap` | Annual rate increase cap | TV-MSA-2024 5.3, 8% with 60 days' notice |
| `dpa` | DPA before customer data | TV-MSA-2024 8.1 |
| `delay_credit` | Credit for late deliverables | TV-MSA-2024 9.1, 2% a week up to 10% |
| `insurance` | Minimum insurance | TV-MSA-2024 11, ₹2 crore |
| `change_request` | Changes need a signed change request | TV-MSA-2024 12.1, CH-MSA-2026 9.1 |
| `deliverable` | A due deliverable, with keywords to find it in email | SOW-0438 4.2, due 15 Nov 2026, keywords "data-quality report", "clean-up", "sign-off pack" |
| `delivered` | Already delivered | SOW-0391 3, SOW-0438 4.1 |
| `renewal_cap` | Renewal price cap with a notice date | KA-MSA-2025 4.2, 7%, notice by 1 Nov 2026 |
| `auto_renew_ban` | No auto-renewal without written agreement | KA-MSA-2025 4.3 |

### TV-MSA-2024, Trivenika (signed 2 Apr 2024)

| Clause | Text |
|---|---|
| 2.1 Term | 2 Apr 2024 to 1 Apr 2027. |
| 2.2 Renewal | Renews automatically for 12 months unless either party gives 60 days' written notice. |
| 3 Order of precedence | SOW prevails on scope and dates; MSA on everything else. |
| 4.1 Delivery dates | Deliverables are due on the dates in their SOW. |
| 4.2 Notice of delay | At least 10 business days' written notice before the due date. |
| 4.3 New dates | A new date applies only once agreed in a signed change request. |
| 5.1 Fees / 5.2 Rates | Fees per SOW; rates in Schedule A. |
| 5.3 Rate increases | Fixed until 1 Apr 2026; then at most 8% once a year with 60 days' written notice. |
| 6 Payment | 30 days from a valid invoice quoting SOW and PO. |
| 7.1 Key personnel | Replacement only with prior written consent. |
| 8.1 Data processing | DPA signed before customer personal data is processed. |
| 9.1 Delay credits | 2% of the SOW's fees per full week late, up to 10%. |
| 10 Liability | Capped at fees paid in the previous 12 months. |
| 11 Insurance | Professional indemnity of at least ₹2 crore. |
| 12.1 Changes | Scope, fee or date changes need a change request signed by both. |
| 13 Termination | 30 days' notice for convenience. |
| 14 Governing law | India; courts at Pune. |

Schedule A (per person-month): Solution Architect ₹2,80,000; Senior Salesforce Developer, Data Migration Specialist, Project Manager ₹1,80,000 each. With the 8% cap the maxima are ₹3,02,400 and ₹1,94,400.

Other documents: TV-NDA-2024 (mutual NDA, 3-year obligations), SOW-0391 (₹8L, delivered 28 Aug 2026), SOW-0412 (₹9L, 1 Sep to 30 Nov 2026, P1 response in 2 hours, weekends out of scope), SOW-0438 (₹9L; 4.1 cleaned dataset by 30 Oct, delivered 29 Oct; 4.2 final data-quality report and sign-off pack by 15 Nov 2026; 6.1 lead Vivek Kulkarni), KA-MSA-2025 (2 term to 31 Dec 2026; 4.1 renewal needs a signed order form; 4.2 7% cap, notice by 1 Nov 2026; 4.3 no auto-renewal without written agreement), CH-MSA-2026 9.1, TB-MSA-2025 5.1 and 5.2, PW-ORD-2025 3.

### Supplier history (used for predictions)

`data/contracts.json → history`. Every prediction that uses it ends with "Based on sample history in this prototype."

| Supplier | History |
|---|---|
| Trivenika | 2025 ISO certificate: asked Mon 3 Mar, received Fri 7 Mar (4 business days). 2024 insurance certificate: 2 business days. Commercial replies: same day on average. |
| Kosha | 2025 order-form correction: 6 business days. |
| Sukhda | 2025 insurance certificate: 9 business days. |
| TalentBridge | 2 contractor replacements in 2025, each needing a seniority check. |

### Showing the contracts

- Any clause reference (citation chips `§ MSA 5.3`, conflict quotes, the contract card, supplier Commitments, "Checked against the contracts") opens the PDF text in the source viewer with that clause highlighted. The "Original file" tab shows the real PDF.
- The supplier page has a **Commitments** table: commitment · value · clause link · next date (with "(passed)" for past dates), plus the supplier history line.

## `checkCommitments(state, req, folded)`

Runs inside `analyze` for every request after facts are folded. Returns `{checks, conflicts, clauses}`.

- **checks**: `{id, docId, clause, status: consistent | conflict | note, text, emailId}`. `runRules` logs each new check once (`req.checksSeen`) as an Ava action: "Checked against SOW-0438 4.2: goes against the contract. 20 Dec 2026 is 35 days after the due date (15 Nov 2026)."
- **conflicts**: become `against_contract` conflict cards (severity blocking, owner Karan) with the email sentence on one side and the clause text on the other, an `impact` in rupees and an `impactText`.
- **clauses**: the clauses relevant to this deal, for the "What the contract says about this deal" card.

### The checks

| Check | Logic | Result in the scenarios |
|---|---|---|
| NDA | NDA on file | "Found TV-NDA-2024, signed 14 Mar 2024. In date." |
| Rate cap (MSA 5.3, Schedule A) | Reads the rate table rows of the latest quote (`Role Qty Months ₹rate ₹amount`). For each role, max = Schedule A × 1.08. Over = (rate − max) × qty × months. | Proposal v1: Architect ₹3,00,000 vs ₹3,02,400 consistent (tick). Senior ₹2,00,000: over by ₹5,600 × 2 × 2 = ₹22,400. Data Migration: ₹5,600 × 1 × 2 = ₹11,200. PM 50%: ₹5,600 × 0.5 × 2 = ₹5,600. **Total ₹39,200.** Conflict "Rates break the MSA cap by ₹39,200" with per-line notes and "No written notice of a rate increase was found…" (5.3 needs 60 days). Id is stable per MSA, so Proposal v2 updates the same card and Proposal v3 (₹1,94,400 rates) closes it. |
| Delivery (SOW deliverable, MSA 4.2, 4.3, 9.1, 12.1) | Finds supplier email sentences that mention a deliverable's keywords and a date. Days late = new date − due date. Weeks = floor(days / 7). Credit % = min(2 × weeks, 10). Credit = SOW fees × %. Notice = business days from the email to the due date. | Arjun on Thu 12 Nov: "the final data-quality report for the CRM clean-up will now come on 20 Dec". 20 Dec − 15 Nov = **35 days = 5 weeks**, 2% × 5 = 10% (the cap) of ₹9,00,000 = **up to ₹90,000**. Notice: Thu 12 and Fri 13 = **2 business days; 10 required**. New date needs a signed change request (4.3, 12.1). |
| Renewal cap (KA-MSA-2025 4.2) | % increase over the baseline subscription vs the cap | First form: 12% over the 7% cap (max ₹19.26L). Revised form: "5% increase: within the 7% cap." |
| Renewal notice (4.2) | First supplier email vs the notice date | 23 Nov is after 1 Nov: "Notice came 38 days before term end; 60 required (by 1 Nov 2026)." |
| Auto-renewal (4.3) | Auto-renew fact on the form | First form: conflict. Revised form: "No automatic renewal." |
| Insurance (MSA 11) | Cover amount on the certificate vs ₹2 crore | Consistent for Trivenika's certificate |
| DPA (MSA 8.1) | Data access confirmed | Note: "A DPA must be signed before customer data is processed. Assigned to Legal review." |

On the Kosha renewal, the cap, notice and auto-renewal results are added as clause-backed lines to source A of the existing renewal conflict card, rather than a second card.

### Resolving contract conflicts

- Rate conflict closes automatically when the latest quote's rates are within the cap ("Rates now within the 8% cap: ₹39,200 over-charge removed.").
- Delivery conflict is resolved by a person, e.g. Karan's "Require a change request" with the note "Delay credit of up to ₹90,000 (MSA 9.1) for Legal to confirm." The note is stored in `req.contractIssues` and appears in the handoff packet under "Contract issues raised at intake". Ava never applies the credit.

### Where checks show up

- Captured mail, "Ava recorded" panel: **Checked against the contracts**, ticks and crosses for that email.
- Request page: **What the contract says about this deal**, 3 to 5 clauses. Order: each conflict's first clause, then MSA 8.1, 9.1 and 12.1 when relevant, then the rest. For REQ-1047 at the end: MSA 5.3, SOW-0438 4.2, MSA 8.1, 9.1, 12.1. Each shows ✓ Checked, ✗ Goes against (open conflict), or Raised, handled (resolved conflict).
- Dashboard: "Contract terms checked" counter.
- Timeline and Ava did: one line per check.
