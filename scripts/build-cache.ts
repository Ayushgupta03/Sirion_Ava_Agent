// Regenerates /data/extraction-cache by running the real AI pipeline on the scripted emails.
// Run with a key:  ANTHROPIC_API_KEY=... npm run build-cache
import fs from "fs";
import path from "path";
import { extractWithAI } from "../lib/ai";
import { SCRIPTED, contrastEmails } from "../lib/scripted";
import seed from "../data/seed.json";

async function main() {
  const emails = [...Object.values(SCRIPTED), ...contrastEmails("2026-11-12T10:12:00+05:30")];
  const open: Record<string, string> = { "t-sfm": "REQ-1047", "t-kosha": "REQ-1063" };
  for (const e of emails) {
    const result = await extractWithAI({
      email: { from: e.from, to: e.to, cc: e.cc, subject: e.subject, body: e.body, sentAt: e.sentAt },
      attachments: e.attachments.map((a) => ({ name: a.name, text: a.pages.map((p, i) => `--- page ${i + 1} ---\n${p.join("\n")}`).join("\n") })),
      context: { knownSuppliers: seed.suppliers.map((s) => ({ name: s.name, domain: s.domain, known: s.known })), openRequests: open[e.threadId] && e.id !== "e-a1" && e.id !== "e-b1" ? [{ id: open[e.threadId], thread: e.threadId }] : [] },
    });
    fs.writeFileSync(path.join("data", "extraction-cache", `${e.id}.json`), JSON.stringify(result, null, 1));
    console.log("cached", e.id);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
