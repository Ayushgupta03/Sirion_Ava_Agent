// Runs every cached AI output in the scripted scenarios through the evals in lib/evals.ts.
// Usage: npm run eval            (exit code 1 if any check fails)
//        npm run eval -- --json  (machine-readable)
import { applyEvent, initialState } from "../lib/engine/pipeline";
import { SCENARIO_A, SCENARIO_B, SEED_EVENTS } from "../lib/story";
import { evalPlan, evalRead, evalRec, groupByVersion, type EvalRow } from "../lib/evals";
import type { AiPlan, AiRead, AiRec } from "../lib/aiTypes";

export function runEvals(): EvalRow[] {
  const rows: EvalRow[] = [];
  let s = SEED_EVENTS.reduce(applyEvent, initialState());
  for (const step of [...SCENARIO_A, ...SCENARIO_B]) {
    for (const b of step.events) {
      const e = b(s); if (!e) continue;
      if (e.kind === "ai") {
        const issues = e.layer === "read" ? evalRead(e.output as AiRead, s, e.requestId) : e.layer === "plan" ? evalPlan(e.output as AiPlan, s, e.requestId) : evalRec(e.output as AiRec, s, e.requestId);
        rows.push({ step: step.id, requestId: e.requestId, layer: e.layer, key: e.key, source: e.source, promptVersion: e.promptVersion, issues });
      }
      s = applyEvent(s, e);
    }
  }
  return rows;
}

if (process.argv[1]?.includes("eval-ai")) {
  const rows = runEvals();
  if (process.argv.includes("--json")) { console.log(JSON.stringify(rows, null, 1)); }
  else {
    for (const r of rows) {
      const fails = r.issues.filter((i) => i.severity === "fail"), warns = r.issues.filter((i) => i.severity === "warn");
      console.log(`${fails.length ? "FAIL" : warns.length ? "WARN" : "PASS"}  ${r.step.padEnd(3)} ${r.layer.padEnd(4)} ${r.key.slice(0, 48).padEnd(48)} ${r.source}`);
      for (const i of r.issues) console.log(`      ${i.severity}: ${i.check}: ${i.detail}`);
    }
    console.log("\nBy prompt version:");
    for (const g of groupByVersion(rows)) console.log(`  ${g.version.padEnd(24)} ${g.outputs} outputs, ${g.failing} failing, ${g.warnings} with warnings`);
    const f = rows.filter((r) => r.issues.some((i) => i.severity === "fail")).length;
    console.log(`\n${rows.length} outputs checked, ${f} failing, ${rows.filter((r) => r.issues.some((i) => i.severity === "warn")).length} with warnings.`);
    process.exit(f ? 1 : 0);
  }
}
