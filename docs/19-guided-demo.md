# 19 Guided demo and in-product guidance

How a first-time viewer is taught the product: the demo bar, a coach card for every step, a short orientation, an end-of-scenario debrief, a Help menu, page tips and glossary terms. All of it lives in `components/guide/`, `lib/guide.ts` and `lib/guideStore.ts`. None of it touches the engine: the guide reads state, never writes it.

## Why it is built this way

The demo has one job: get a reviewer who has a few minutes to see, in order, the moments that prove Ava works, and then to try it themselves. Four things were wrong with the first dock:

| Problem seen in the first dock | What replaced it |
|---|---|
| One caption said what happened but not where to look. "Show me where" was a text link, and the highlight lasted 2 seconds. | A **coach card** with a steady ring on the element, a "Look here" pin, 2 things to notice and a "Why it matters" line. |
| The dock did five jobs in two rows: steps, scenario, tools, reset, minimise. | **Demo bar**: one row for the story. Tools and reset sit behind one menu. |
| Two toasts ("Now acting as", "What this reached") stacked on top of the page at the same moment as the caption: three narrators. | The card carries both. The toasts stay quiet while it is showing, and still work for actions the viewer takes. |
| No agenda, no payoff. The last step ended on a disabled "Finished" button. | An **outline** of every step with jump, and a **debrief** with the scenario's numbers and four next actions. |

## Parts

| Part | File | What it does |
|---|---|---|
| Demo bar | `components/guide/DemoBar.tsx` | Scenario and outline button, step count and time, clickable progress segments, the step title, **Tips** switch, tools menu, Back and Next. Keyboard: → next, ← back, Esc closes menus (ignored while typing, inside a dialog, or on a tab strip). Starts as a pill on phones. |
| Outline | `DemoBar.tsx` | Every step of A and B with title and time. ✓ for done, the current step marked. Clicking a step replays the engine to it. |
| Coach card | `components/guide/StepCoach.tsx` | For the current step: title, what to notice, why it matters, who the step was done as (with "View as"), who it reached. Rings the element named by the step's `pulse` key and pins "Look here: …". Sits on the side of the screen that covers that element least. Fold-down and "hide tips" controls. If the viewer has navigated away it says so and offers "Take me back to this step". On the last step it offers "See what this proved". |
| Orientation | `components/guide/UiTour.tsx` | Four anchored stops (demo bar, clock, View as, Help) with a spotlight. Starts once, 0.9 s after the first demo step in a browser. Esc skips. A stop whose control is not on screen is skipped. |
| Debrief | `components/guide/Debrief.tsx`, `debriefFor` | Outcome chip; calendar time, Prayaan's own time and supplier wait; Ava actions and people decisions; what Ava caught; four next actions (the other scenario or a replay, Ask Ava, your own email, dashboard). |
| Help menu | `components/guide/HelpMenu.tsx` | Top bar. This page's purpose and 3 tips; **Try it yourself** (6 tasks, ticked from the event log); the glossary; shortcuts; "Replay the orientation" and "Show all tips again". |
| Page tips | `components/guide/PageTip.tsx` | The first time a page is opened, a small card says what it is for. Quiet during demo steps, the orientation, the debrief and the Help menu. |
| Terms | `components/guide/Term.tsx` | A dotted-underline word that defines itself on hover, focus or click. `Rich` turns `{{term-id|text}}` markers in copy into terms. Used on the landing trust line, Captured mail header, Dashboard "Clean and fast" and in the coach copy. |
| Guide state | `lib/guideStore.ts` | What this browser has been shown: `tourSeen`, `coach` on or off, `tipsSeen`, `viewedAs`. Saved to localStorage under `ava-guide-v1`. Separate from the event log, so "Reset demo" does not bring the tour back. |
| Content and rules | `lib/guide.ts` | Step coaching copy, scenario blurbs, glossary, page help, the task list, `taskStatus`, `debriefFor`, `fmtSpan`. No React, fully tested. |

## Step coaching

`STEP_GUIDE[stepId]` in `lib/guide.ts`: `title` (shown in the bar and outline), `where` (the "Look here" label), `notice` (two lines), `why` (one line). The element to point at is the step's existing `pulse` key (`data-pulse="…"` in the page). If the element is not on screen the card shows "Show me where", which fires the same pulse the dock always fired.

To add or change a step: edit `lib/story.ts` for the events, then add the matching `STEP_GUIDE` entry. `tests/guide.test.ts` fails if a step has no coaching, if a coaching entry has no step, if a step has no `pulse`, if copy uses a banned word or runs past three sentences, or if a `{{term|…}}` marker names a missing glossary term.

## Try it yourself: how tasks tick

| Task | Done when |
|---|---|
| Watch Scenario A / B to the end | `pos.A` or `pos.B` reaches the last step |
| View as another person | the viewer switched person once (the only flag; the log cannot hold it) |
| Decide something yourself | an event without `tag` and with a human `actor` (story events are tagged) |
| Start a request in Ask Ava | `northStar(state).fromAsk > 0` |
| Send your own email to Ava | an untagged email event with `origin: "composed"` |

## Copy rules for guidance

Same as [14](14-design-system.md): plain words, names, numbers, no paragraph over three sentences, no banned words. Say what to look at, then why it matters. Never explain a button the label already explains.

## Accessibility

The coach card is a labelled region with `aria-live="polite"`. The orientation and debrief are `role="dialog" aria-modal`, close with Esc, and move focus in. Terms are buttons with `aria-describedby`. The progress segments are buttons with names. The Tips control is a `role="switch"`. Animation is off under `prefers-reduced-motion`. The bar, card and menus reflow to 320 px; on a phone the card shows title and notes only and the bar title is hidden while the card is open.

## Known limits

- Page tips and terms are in place on the landing page, Captured mail, Dashboard and the coach copy. The request page, Today and the AI labels (`Cached`, `Critical path`, `Decision Receipt` buttons) do not yet use `Term`, because they were being edited in another branch. See roadmap D1.
- The "Try it yourself" ticks live in the browser. Nothing is measured on a server, so there is no completion rate.
- The coach card can cover part of a wide section (for example Problems Ava found). It sits on the emptier side and can be folded down.
