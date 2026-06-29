import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.email!;

  const { data: doc, error: fetchErr } = await supabaseAdmin
    .from("documents")
    .select("file_url")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(doc.file_url);
  const storagePath = url.pathname.split("/storage/v1/object/public/documents/")[1];
  if (storagePath) {
    await supabaseAdmin.storage.from("documents").remove([storagePath]);
  }

  const { error } = await supabaseAdmin.from("documents").delete().eq("id", id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
