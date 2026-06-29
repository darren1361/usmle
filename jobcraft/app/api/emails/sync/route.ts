import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchLinkedInAlerts } from "@/lib/gmail";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.email!;
  const accessToken = session.access_token;

  if (!accessToken) {
    return NextResponse.json({ error: "No Gmail access token" }, { status: 400 });
  }

  const alerts = await fetchLinkedInAlerts(accessToken);

  let synced = 0;
  for (const alert of alerts) {
    const { error } = await supabaseAdmin.from("jobs").upsert(
      {
        user_id: userId,
        gmail_message_id: alert.messageId,
        title: alert.title,
        company: alert.company,
        location: alert.location,
        job_url: alert.jobUrl,
        email_date: alert.emailDate,
        raw_description: alert.rawDescription,
      },
      { onConflict: "user_id,gmail_message_id" }
    );
    if (!error) synced++;
  }

  return NextResponse.json({ synced, total: alerts.length });
}
