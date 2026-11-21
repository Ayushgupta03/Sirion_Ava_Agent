# Ava: contract intake from supplier email (prototype)

Nobody fills in an intake form. Ava builds the contract request from the emails people already send to suppliers, and the request cannot leave intake until every approval matches the latest facts.

All companies, people and numbers are fictional.

## Run locally

```bash
npm install
npm run dev        # generates sample PDFs/XLSX, then starts Next.js on :3000
npm test           # engine unit + scenario tests (17)
```

Optional: `ANTHROPIC_API_KEY=...` turns on live AI extraction for composed email (`AVA_MODEL`, default `claude-sonnet-5-5`). Without a key, composed email uses the basic extractor and is labelled "Basic extraction (AI unavailable)".

## Deploy on Vercel

Import the folder (or push it to GitHub and import). Framework: Next.js. The build command `npm run build` regenerates `public/samples/*` and `data/sample-texts.json` from `scripts/make-samples.ts` before `next build`. Add `ANTHROPIC_API_KEY` in Project Settings > Environment Variables for live AI.

## How it is built

- `lib/engine/pipeline.ts`: the single pipeline (ingest, classify, file, diff, rules, notify, log). Every scripted email, composed email and user action goes through `applyEvent`. State is a replay of the event log (persisted in localStorage).
- `lib/engine/rules.ts`: policy as plain code: `computeCumulativeSpend`, `computeRouting`, checklist, `approvalStatus` (reopen), conflict detection, `computeHandoffState`.
- `lib/engine/facts.ts`: folds extractions into facts with versions; `applySupersession` (rule 7).
- `lib/story.ts`: the story player is only a list of timed events fed to the same engine.
- `app/api/ava`: AI extraction (zod-validated, one retry). `app/api/extract`: server-side PDF/XLSX text extraction.
- `tests/engine.test.ts`: ₹38L, ₹39.5L, ₹21.3L, ₹41L, two approvals reopened, handoff blocked, timing panel, and both scenarios with the basic extractor and no cache.

## Notes

- `data/extraction-cache/*.json` was written in the exact `/api/ava` output shape without an API key available. Run `ANTHROPIC_API_KEY=... npm run build-cache` to regenerate it from the real model before submission. The tests show the scenarios reach the same outcomes with no cache at all.
- PDF text extraction uses `unpdf` (a serverless build of pdf.js) for reliability on Vercel.
- Neha's budget owner is not named in the brief; the prototype adds Ritu Bansal, Head of Marketing Ops.
- Request numbers advance with simulated time to reflect other teams' requests, so the Kosha renewal is REQ-1063.
