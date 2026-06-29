import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseResumeText } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  let text = "";

  const mime = file.type;

  if (mime === "application/pdf" || file.name.endsWith(".pdf")) {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
    const parsed = await pdfParse(buffer);
    text = parsed.text;
  } else if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    text = buffer.toString("utf-8");
  }

  if (!text.trim()) return NextResponse.json({ error: "Could not extract text from file" }, { status: 400 });

  const parsed = await parseResumeText(text);
  return NextResponse.json(parsed);
}
