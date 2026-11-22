# 17 AI evals

The quality layer for the AI. Evals check that every read, plan and recommendation keeps the promises in the system prompt. They run offline on cached outputs (`npm run eval`, and in `npm test`) and online on every live answer as it arrives.

## Run

```bash
npm run eval            # table of every cached output: PASS / WARN / FAIL with details; exit 1 on any FAIL
npm run eval -- --json  # machine-readable rows
npm test                # includes tests/evals.test.ts
```

Current result: 27 outputs checked (Scenario A and B), 0 failing, 0 warnings.

## Checks (`lib/evals.ts`)

| Check | Layer | Severity | Rule |
|---|---|---|---|
| `max-4-sentences` | read | fail | At most 4 sentences |
| `cite-every-claim` | read, rec | fail | Every read sentence has a citation; every non-bullet recommendation has one |
| `citation-resolves` | all | fail | Email ids exist; attachment ids exist; contract ids and clauses exist in `data/contracts.json` |
| `number-not-from-code` | all | fail | Every ₹ figure (₹21,10,800, ₹38L, ₹21.5L, ₹2 crore) must match a figure in the request context, its emails and attachments, its contract checks or its conflicts (tolerance for lakh rounding) |
| `banned-word` | all | fail | None of the banned words |
| `long-sentence` | all | warn | Sentences over 40 words |
| `history-label` | all | warn | A prediction from supplier history must say "Based on sample history in this prototype." |
| `plan-validation` | plan | fail / warn | `validatePlan` had to insert a missing policy step (fail), reassign an owner or remove a cycle (warn) |
| `ava-step-has-reason` | plan | fail | Every "Added by Ava" step has a reason |
| `prediction-reason` | plan | fail | A predicted date has a reason |
| `critical-path-id` | plan | warn | Critical path ids exist |
| `reasoning-max-2` | rec | fail | Reasoning is at most 2 sentences |
| `never-decides` | rec | fail / warn | Never claims to have approved, rejected or applied a credit (fail); warns on an outright "Approve it" |

The eval caught a real gap while being built: the cached reads used ₹25L and ₹1,26,000, which code had not given the AI. The fix was in the context (`numbersFromCode.vpLimit`, `numbersFromCode.renewalSaving`), not in the eval.

## How the offline run works

`scripts/eval-ai.ts` replays the seed and both scenarios through `applyEvent`. At each `ai` event it evaluates the output against the state just before that event (what the AI would have seen), then applies the event. `runEvals()` is exported for tests.

## Live guardrail

In `applyAi` (`lib/engine/pipeline.ts`), live outputs are evaluated before they are stored. Issues are kept on the stored output (`evalIssues`). Failures:

- are logged on the request timeline ("Ava's read failed 1 output check(s): number-not-from-code."), and
- show as a red "n checks failed" badge next to the label (`EvalBadge`), with details in the tooltip.

The output is still shown, so people can judge it; the badge tells them not to trust it blindly. A stricter option (roadmap) is to discard failing outputs and keep the rules fallback.

## Adding a check

1. Write it in `lib/evals.ts` inside `evalRead`, `evalPlan`, `evalRec` or `common`, pushing `{severity, check, detail}`.
2. Add a negative case in `tests/evals.test.ts` (an output that must fail).
3. Run `npm run eval`; fix cached outputs or context, not the check, unless the check is wrong.

## Comparing prompts or models

Live outputs carry the prompt version that produced them, and `npm run eval` ends with results grouped by version (`groupByVersion` in `lib/evals.ts`), so a prompt change shows up as its own row. Scripted outputs group as "cached (hand-written)".

1. Set `ANTHROPIC_API_KEY` and `AVA_MODEL`.
2. Generate outputs for every scripted step (roadmap N2 script) into a folder per prompt or model version.
3. Run the evals over each folder and compare fail counts per check.
4. For truthfulness beyond rules, add the model-graded faithfulness eval (roadmap N3): for each sentence and its cited quote, ask a grader "supported / partly / not supported".

## Not covered yet

Faithfulness of a sentence to its cited quote; whether a recommendation is the right one (needs labelled examples); extraction quality (precision and recall of facts against hand labels for the sample files); latency and cost per layer.
