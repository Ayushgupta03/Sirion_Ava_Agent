# Ava: contract intake from supplier email (prototype)

Nobody fills in an intake form. Ava reads every supplier email, plans the work, does the legwork, and tells each person the one decision that needs them. A request cannot leave intake until every approval matches the latest facts.

The AI understands, plans, acts and advises. Code enforces policy. People decide.

- **Live app:** https://sirion-ava-agent.vercel.app
- **Case:** ISB assignment on Sirion (contract lifecycle management). Ava covers intake, the stage before a contract exists.
- **Data:** every company, person, contract and number is fictional.

## Quick start

```bash
npm install
npm run dev     # generates sample PDFs/XLSX and contract PDFs, then starts Next.js on :3000
npm test        # 55 engine, scenario, intake, metrics, guide and eval tests (Vitest)
npm run eval    # checks every cached AI output against the prompt's rules
npm run build   # samples + production build
```

Optional environment variables:

| Variable | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Turns on live AI for extraction, Ava's read, Ava's plan and recommendations. Without it, everything still works with labelled fallbacks. |
| `AVA_MODEL` | Model id for all AI calls. Default `claude-sonnet-5-5`. |

## Documentation

| Doc | What it covers |
|---|---|
| [01 Overview](docs/01-overview.md) | What Ava is, the principles, the fictional world, who uses it |
| [02 Architecture](docs/02-architecture.md) | Stack, event sourcing, the single pipeline, state, file map |
| [03 Policy rules](docs/03-policy-rules.md) | The 11 rules, routing, checklist, conflicts, handoff, reopen and decrease rules |
| [04 Contracts and checks](docs/04-contracts-and-checks.md) | Contract PDFs, clauses, supplier history, `checkCommitments` and every computed consequence |
| [05 AI layers](docs/05-ai-layers.md) | Extraction, Ava's read, plan, recommendations, Ava did; API routes, prompts, validation, fallbacks, labels |
| [06 Scenarios](docs/06-scenarios.md) | Scenario A (9 steps), Scenario B (5 steps), the repeat request, the orphan invoice, background requests |
| [07 Screens](docs/07-screens.md) | Every page and component, what it shows and why |
| [08 Data](docs/08-data.md) | Seed, contracts, background, sample files, extraction cache, cached AI outputs |
| [09 Testing](docs/09-testing.md) | Unit and scenario tests, browser walk-throughs, acceptance checks and their status |
| [10 Deployment](docs/10-deployment.md) | GitHub, Vercel, build, environment variables, adding the API key |
| [11 Build history](docs/11-build-history.md) | Every revision in order, design decisions, bugs fixed, known limits |
| [12 Product spec](docs/12-product-spec.md) | Problem, users and jobs, scope and non-goals, AI vs code vs people, metrics, risks |
| [13 Roadmap](docs/13-roadmap.md) | Prioritized backlog with where in the code, done-when and effort |
| [14 Design system](docs/14-design-system.md) | Tokens, type, colour meaning, components, patterns, copy, accessibility, design debt |
| [15 Developer guide](docs/15-developer-guide.md) | Setup, conventions, recipes (rules, conflicts, contract checks, AI layers, prompts, story steps, screens), debugging |
| [16 API reference](docs/16-api-reference.md) | Routes with request and response JSON, actions, events |
| [17 AI evals](docs/17-ai-evals.md) | Offline and live output checks, how to add checks and compare models |
| [18 Ask Ava](docs/18-ask-ava.md) | The front door before any supplier email, autonomy for routine messages, the supplier view, Prayaan's own time, and "What this reached" |
| [19 Review and handover](docs/19-review-and-handover.md) | The product review behind revision 4, decisions, what was verified, known gaps, the runbook for turning on live AI, and the submission checklist |
| [20 Guided demo](docs/20-guided-demo.md) | The demo bar, coach cards, orientation, debrief, Help menu, page tips and glossary terms |
| [ADRs](docs/adr/README.md) | Thirteen architecture decision records |
| [Glossary](docs/glossary.md) | Every term used in the app and docs |

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). CI (`.github/workflows/ci.yml`) runs types, tests, evals and the build on every push and pull request. Copy `.env.example` to `.env.local` for a key.

## Honest notes

- No API key was available while building. The extraction cache (`data/extraction-cache/*.json`) and the cached AI outputs for scripted steps (`lib/aiScript.ts`, `data/background.json`) were written by hand in the exact response shapes. They are labelled **Cached** in the app. See [05 AI layers](docs/05-ai-layers.md) for how to regenerate them with the model.
- The live AI routes for read, plan and recommend are built and validated, but have not run against the model yet. The rules fallback path is tested.
