# 10 Deployment

## Where it lives

| What | Where |
|---|---|
| Code | GitHub `Ayushgupta03/Sirion_Ava_Agent`, branch `main` |
| Hosting | Vercel project `sirion-ava-agent` (team `guptayush0022-5606`) |
| Production URL | https://sirion-ava-agent.vercel.app |
| Deploys | Automatic on every push to `main` (Vercel GitHub integration). Other branches get preview deployments. |

## Build

- Framework preset: Next.js. Build command: `npm run build`, which runs `tsx scripts/make-samples.ts` (writes `public/samples/*` including `contracts/*.pdf`, and `data/sample-texts.json`) and then `next build`.
- Generated files are not committed; Vercel regenerates them on every build.
- Runtime: API routes run on Node.js (`export const runtime = "nodejs"`, `maxDuration = 60`).
- Routes: static pages for `/`, `/mail`, `/today`, `/requests`, `/dashboard`, `/conflicts`, `/settings`, `/suppliers`; dynamic `/requests/[id]`, `/suppliers/[id]`, `/story/[slug]`, `/inbox` (redirect), and the API routes.

## Environment variables

| Name | Required | Effect |
|---|---|---|
| `ANTHROPIC_API_KEY` | No | Live AI for extraction, read, plan and recommendations. Not set at the time of writing. |
| `AVA_MODEL` | No | Model id. Default `claude-sonnet-5-5`. |

To turn on live AI: Vercel → Project → Settings → Environment Variables → add `ANTHROPIC_API_KEY` for Production (and Preview if wanted) → Redeploy. `GET /api/ava` then returns `{"ai": true}` and the app labels new output "Live AI". Without the key the app works fully with labelled fallbacks.

## Access

The production alias is public. Vercel Deployment Protection (SSO) applies to some preview URLs; a request to turn it off from here was refused by a safety classifier and was not retried, so share the production URL.

## How changes were shipped during the build

1. Work in a local copy, run `npx tsc --noEmit`, `npm test` and `npm run build`.
2. Copy into the repository clone, excluding `node_modules`, `.next`, `tsconfig.tsbuildinfo`, `next-env.d.ts`, `.gitignore`, `public/samples` and `data/sample-texts.json`.
3. Commit with the Claude co-author and session trailers, push to `main`.
4. Confirm the Vercel deployment for that commit reached Ready.

## Local

```bash
npm install
npm run dev          # http://localhost:3000
ANTHROPIC_API_KEY=... npm run dev   # with live AI
```
