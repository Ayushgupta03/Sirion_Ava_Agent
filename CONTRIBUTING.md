# Contributing

1. Read [docs/12 Product spec](docs/12-product-spec.md) (what Ava must and must not do) and [docs/02 Architecture](docs/02-architecture.md).
2. Pick an item from [docs/13 Roadmap](docs/13-roadmap.md) or open an issue with a template.
3. Follow the recipes in [docs/15 Developer guide](docs/15-developer-guide.md).
4. Before pushing: `npx tsc --noEmit && npm test && npm run eval && npm run build`. CI runs the same.
5. Pushing to `main` deploys to production on Vercel. Use a branch and a pull request for anything non-trivial; branches get preview deployments.
6. Record lasting decisions as an ADR in [docs/adr](docs/adr/README.md).

House rules: policy, money and dates live in `lib/engine/`; every engine change has a test; every AI output is cited, labelled and evaluated; people make every decision; plain words in the UI.
