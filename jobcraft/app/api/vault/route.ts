import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("user_id", session.user.email!)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.email!;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const docType = (formData.get("doc_type") as string) ?? "other";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const path = `${userId}/${Date.now()}_${file.name}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from("documents")
    .upload(path, buffer, { contentType: file.type });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: urlData } = supabaseAdmin.storage.from("documents").getPublicUrl(path);

  const { data, error } = await supabaseAdmin
    .from("documents")
    .insert({
      user_id: userId,
      name: file.name,
      doc_type: docType,
      file_url: urlData.publicUrl,
      file_size: buffer.length,
      mime_type: file.type,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
