# 14 Design system

The design layer: tokens, type, colour meaning, components, patterns and copy. Change these here first, then in code.

## Tokens (`app/globals.css`, Tailwind v4 `@theme`)

| Token | Value | Use |
|---|---|---|
| `--color-accent` | `oklch(0.49 0.17 262)` | Primary actions, active nav, focus ring, critical path, pulse |
| `--color-accent-700` | `oklch(0.41 0.15 262)` | Hover on primary |
| `--color-accent-50` | `oklch(0.97 0.015 262)` | Subtle accent background (active nav, Ava's read panel) |
| `--color-accent-100` | `oklch(0.93 0.035 262)` | Subtle accent border |
| `--color-ink` | `oklch(0.21 0.02 265)` | Body text |
| `--color-canvas` | `oklch(0.985 0.003 265)` | App background |
| `--font-sans` | Inter | UI text |
| `--font-mono` | IBM Plex Mono | Ids, amounts, times, clause refs (tabular numbers) |

Everything else uses Tailwind's slate, emerald, amber, red, blue and violet scales.

## Type scale

Body 14 px / 1.5. Page title 20–24 px semibold. Card title 14 px semibold. Secondary 12–13 px slate-500. Labels 11–12 px uppercase with 0.05em tracking. Landing headline 36–46 px. `text-wrap: balance` on headings, `pretty` on paragraphs.

## Colour meaning (never decorative)

| Colour | Means | Examples |
|---|---|---|
| Accent blue | Act here / Ava's attention | Primary button, critical path, pulse ring |
| Blue (light) | Policy and contracts | "Required by policy" badge, clause chips `§ MSA 5.3` |
| Violet | Ava's own work and advice | "Added by Ava", Ava recommends box, Cached label, Ava in the log |
| Green | Done, confirmed, ready, consistent | Confirmed facts, ✓ checks, Ready banner, Live AI label |
| Amber | Waiting, unconfirmed, medium confidence, what changed | What changed banner, Unconfirmed, risk reasons |
| Red | Blocked, contradicted, goes against, failed check | Handoff blocked, conflict borders, ✗ checks, eval failure badge |
| Slate | Background, neutral, rules fallback | Background chip, "Summary from rules" label |

## Components (`components/`)

| Component | File | Purpose | Notes |
|---|---|---|---|
| `Chip`, `StateChip` | ui.tsx | Status in one word | `StateChip` maps every engine state to tone and label; add new states there |
| `Card`, `CardHead` | ui.tsx | Section container with title, sub, right slot | |
| `Button` | ui.tsx | primary, secondary, danger, ghost; small | One primary per card |
| `SourceLink`, `Quote` | ui.tsx | A source as a link; a quoted line with source and note | Handles email, attachment, contract clause |
| `Stat`, `PageTitle`, `Empty` | ui.tsx | Counters, page headers, empty states | Empty states say what to do next |
| `AiLabel` | ai.tsx | Live AI / Cached / Summary from rules | On every AI output |
| `EvalBadge` | ai.tsx | "n checks failed" on live outputs | Tooltip lists checks |
| `CiteChip` | ai.tsx | Inline citation (✉ email, ▤ document, § clause) | Opens the source viewer |
| `AvaRead` | ai.tsx | Cited summary, full or compact | |
| `AvaPlan` | ai.tsx | Vertical step list with badges, critical path, prediction, What changed | |
| `AvaRecommends` | ai.tsx | Recommendation, reasoning, confidence, draft, actions | `readOnly` when shown in a second place |
| `AvaDid`, `ActsBanner` | ai.tsx | Log and counts | |
| `ContractCard`, `EmailChecks` | ai.tsx | Clauses with status; per-email checks | |
| `ConflictCard` | ConflictCard.tsx | Numbered sections 1–6 | Same card everywhere |
| `ItemCard` | ItemCard.tsx | One decision for one person | `compact` on the request page |
| `ReceiptModal`, `HandoffPacket`, `FactsTable`, `ChecklistView`, `ApprovalsView`, `RoutingPanel`, `DocumentsPanel`, `TimelineView`, `DraftBox` | request.tsx | Request details | |
| `SourceViewer` | SourceViewer.tsx | Source modal with highlight and compare | |
| `Shell` | Shell.tsx | Sidebar, top bar, demo dock, toasts, pulse | |

## Patterns

- **Lead with the answer.** Every page opens with one sentence of what matters (summary sentence, Ava's read, page intro).
- **What changed, then details.** Banners show the change and one link to the evidence; details collapse.
- **Two sides, never a verdict.** Conflicts show source A and source B with quotes; a person resolves.
- **Advice is boxed and owned.** Ava's advice lives in the violet box with confidence and a label; using it is a logged human action.
- **Progressive disclosure.** Facts, logs, drafts, resolved conflicts and routing explanations are collapsed by default.
- **Pulse what a step changed.** `data-pulse="<target>"` on the element; the dock fires it after each step.
- **Numbers.** Exact amounts in full Indian format (₹21,10,800) where people act; totals in lakh (₹39.11L) in summaries and counters. Mono for ids and amounts.

## Copy rules

Plain words, short sentences, names, numbers, dates. No paragraph over 3 sentences. One date format (`Thu 12 Nov, 10:12`). Say who: "Waiting on Meera Nair: security review", never "Waiting on InfoSec team". Ages: "opened 16 h ago", "opened just now". Banned words: seamless, powerful, leverage, unlock, cutting-edge, empower, game-changer, revolutionary, intelligent, smart. Background data is always marked "Background" and "outside the guided demo". Predictions from history end with "Based on sample history in this prototype."

## Accessibility

Focus ring on every interactive element; buttons are `<button>`; tabs use `role="tablist"`/`tab` with `aria-selected`; dialogs are `role="dialog" aria-modal`; Escape closes the viewer; status is never colour-only (icons ✓ ✗ ! and words); `prefers-reduced-motion` disables animation; reflows to 320 px.

## Known design debt

| Debt | Suggested fix |
|---|---|
| The request page is long once a request has many conflicts | Done: "On this page" jump list in the sticky header; resolved collapsed. Still open: paginate the log |
| The plan's "What changed" line can wrap to three lines at A3 | Render as chips; show the 3 most important and "more" |
| Two places show the same recommendation (Needs you and the conflict card) | Done: on the request page a conflict item links to its card (`conflictAnchor`). Today still shows the full recommendation, by design |
| Background cards look similar to live ones on Today | A distinct, quieter card style |
| Mobile: the demo dock covers content on small screens | Done: the dock starts as a pill under 640 px; opened, its caption sits above the buttons (about 170 px, was about 280); the request header no longer sticks on phones |
| No dark mode | Tokens are OKLCH; add a dark `@theme` layer |
| Copy is inline in components | Move to a copy file per screen (see roadmap L5) |
