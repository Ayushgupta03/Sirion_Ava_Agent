import { NextResponse } from "next/server";
import { extractFile } from "@/lib/extractText";

export const runtime = "nodejs";

// POST multipart form with "file" → { kind, pages, sheets }. Text extraction happens on the server.
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "File over 8 MB" }, { status: 413 });
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    return NextResponse.json(await extractFile(file.name, data));
  } catch (e: any) {
    return NextResponse.json({ error: `Could not read ${file.name}: ${e?.message}` }, { status: 422 });
  }
}
