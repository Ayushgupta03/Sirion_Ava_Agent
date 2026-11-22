import { NextResponse } from "next/server";
import { extractWithAI } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST { email, attachments: [{name, text}], context } → Extraction JSON
export async function POST(req: Request) {
  const body = await req.json();
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI unavailable: no ANTHROPIC_API_KEY set" }, { status: 503 });
  try { return NextResponse.json({ source: "live", result: await extractWithAI(body) }); }
  catch (e: any) { return NextResponse.json({ error: `AI unavailable: ${e?.message ?? "error"}` }, { status: 502 }); }
}
