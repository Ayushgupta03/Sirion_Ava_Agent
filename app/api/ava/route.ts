import { NextResponse } from "next/server";
import { extractWithAI } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST { email, attachments: [{name, text}], context } → Extraction JSON (section 6)
export async function POST(req: Request) {
  const body = await req.json();
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI unavailable: no ANTHROPIC_API_KEY set" }, { status: 503 });
  try {
    const result = await extractWithAI(body);
    return NextResponse.json({ source: "live", result });
  } catch (e: any) {
    return NextResponse.json({ error: `AI unavailable: ${e?.message ?? "error"}` }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ ai: !!process.env.ANTHROPIC_API_KEY, model: process.env.AVA_MODEL || "claude-sonnet-5-5" });
}
