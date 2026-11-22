# 08 Data

All data is fictional and lives in the repository. Nothing is fetched at runtime except the optional AI calls.

## `data/seed.json`

The world: `startClock` (Thu 12 Nov 2026, 09:00 IST), `company` (Prayaan Software, domain `prayaan.example`), `people`, `suppliers` (with contacts and `known`), `contracts` (seed agreements used by the rules: NDA, MSA, SOWs, subscriptions, tax records, security certificates, with dates, amounts, cost centres, expiry, auto-renew and renewal terms), `costCentres` (with budget owners), `policy` (₹25L limit, 90 days, VP, Procurement, InfoSec, Legal, Finance owners). Read through `lib/engine/world.ts`. See [01](01-overview.md) for the tables.

Revision 3 added Aditi Verma (CC-WORKPLACE) and Sameer Kulkarni (CC-PEOPLE) as budget owners, and renamed the Kosha MSA to `KA-MSA-2025`.

## `data/contracts.json`

`docs[]` (contract documents with numbered clauses, kinds, due dates, values, keywords, Schedule A) and `history` (supplier history for predictions). Read through `lib/engine/contracts.ts`. See [04](04-contracts-and-checks.md).

## `data/background.json`

16 background requests. Fields per request:

| Field | Meaning |
|---|---|
| `id, supplier, category, project, requester, dept, amount, createdAt, routes` | Basic request data |
| `stage` | New, Waiting on someone, Approvals, Blocked, Ready |
| `endState` | `legal` for REQ-1035 (Ready for Legal Review) |
| `waitingOn` | A named person or supplier and what for |
| `read` | 2 cached sentences |
| `plan` | `predictedReady`, `predictionReason`, `steps[]` (title, ownerId, source, eta, status, reason) |
| `conflict` | Optional: title, type, sides A and B (quote, clause), clauses, impactText, impact, risk, recommendation |
| `atRisk` | Optional reason for the dashboard |
| `needs[]` | Decisions for named people, each with an optional recommendation or summary bullets |
| `avaDid[]` | Ava actions with time and who they were for |
| `checks, avaActions, decisions` | Counts for the dashboard |

Helpers in `lib/background.ts`: `BACKGROUND`, `bgTotal90` (computed 90-day total per supplier and department), `bgState`, `BG_CONFLICTS`, `BG_TOTALS`.

## Sample files (`scripts/make-samples.ts`)

Generated on every `npm run dev` and `npm run build` into `public/samples/`, with their extracted text in `data/sample-texts.json` (both generated, not committed). PDFs use `pdf-lib` with DejaVu Sans for the ₹ glyph; XLSX uses SheetJS.

| File | Used in |
|---|---|
| Trivenika_Proposal_v1.pdf | A3: ₹20,00,000; rates ₹3,00,000 / ₹2,00,000 |
| Trivenika_RateCard_2026.xlsx | A3: sheets "Rate card 2026" and "Schedule A 2024" |
| Trivenika_Proposal_v2.pdf | A6: adds "Data validation and UAT support … ₹1,50,000", ₹21,50,000 |
| Trivenika_MSA_comments.pdf | A6: supplier comments on clauses (open note for Legal) |
| Trivenika_Insurance_Certificate.pdf | A8 |
| Trivenika_Proposal_v3.pdf | A8: rates ₹1,94,400, UAT kept, subtotal ₹21,10,800, GST ₹3,79,944, total ₹24,90,744 |
| Trivenika_RateCard_2026_v2.xlsx | A8 |
| Trivenika_ISO27001_2026-2029.pdf | A9 |
| Trivenika_SOW_Extension.pdf | Repeat request |
| Kosha_Renewal_Order_Form.pdf | B1: ₹20,16,000, 36 months, auto-renews |
| Kosha_Invoice_KA-7781.pdf | B3: Forecast module add-on |
| Kosha_Renewal_Order_Form_v2.pdf | B4: ₹18,90,000, 12 months, no auto-renewal |
| Kalakriti_Invoice_INV-KDS-2291.pdf | Seed orphan invoice |
| Trivenika_Quote_23L.pdf, Trivenika_ISO27001_expired.pdf, Trivenika_Invoice_TS-5520.pdf, Lumina_Order_Form_AutoRenew.pdf, Navkar_Logistics_Quote.pdf | Test lab |
| contracts/<docId>.pdf | Every contract in `data/contracts.json` |

Every generated document ends with "Fictional document for the Ava prototype."

## Scripted emails (`lib/scripted.ts`)

`e-k1` (Kalakriti invoice, seed), `e-a1` to `e-a5` and `e-a6` (Trivenika thread `t-sfm`), `e-b1`, `e-b3`, `e-b4` (Kosha threads `t-kosha`, `t-kosha-inv`), and `contrastEmails()` (`e-c1`, `e-c2`, thread `t-mkt`, created at the current clock).

Revision 3 changes: `e-a2` body gained the 20 Dec heads-up sentence; `e-a6` is new (Mon 16 Nov 10:40, Proposal v3 and RateCard v2).

## Extraction cache (`data/extraction-cache/*.json`)

One file per scripted email, in the exact `/api/ava/extract` output shape, indexed by `lib/cache.ts`. Written by hand without a key (`e-a6` was derived from `e-a3` with v3 values). Regenerate with `ANTHROPIC_API_KEY=... npm run build-cache`.

## Cached AI outputs (`lib/aiScript.ts`)

`A_READ` (A1, A3, A4, A6, A8, A9), `A_PLAN` (A1, A3, A4, A7, A8), `A_REC` (delivery, rates, data, uat, receipt_budget, receipt_vp), `B_READ` (B1, B3, B4, B5), `B_PLAN` (B1, B3, B4, B5), `B_REC` (renewal, invoice). Story steps add them as `ai` events with source `cached`. Written by hand to match Part 5 of the revision brief.

## Browser storage

The session (events, viewer, scenario position) is stored in `localStorage`. State is replayed from events on load. Reset clears it back to the seed.
