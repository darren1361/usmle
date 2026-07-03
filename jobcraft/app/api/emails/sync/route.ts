import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchJobAlerts } from "@/lib/gmail";
import { supabaseAdmin } from "@/lib/supabase";

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

async function syncFromAccount(
  accessToken: string,
  userId: string
): Promise<{ synced: number; total: number }> {
  const alerts = await fetchJobAlerts(accessToken);

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
        source: alert.source,
      },
      { onConflict: "user_id,gmail_message_id" }
    );
    if (!error) synced++;
  }

  return { synced, total: alerts.length };
}

export async function POST() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.email!;
  const primaryToken = session.access_token;

  let totalSynced = 0;
  let totalAlerts = 0;
  const errors: string[] = [];

  // 1. Sync from primary account
  if (primaryToken) {
    try {
      const result = await syncFromAccount(primaryToken, userId);
      totalSynced += result.synced;
      totalAlerts += result.total;
    } catch (e: any) {
      errors.push(`Primary account: ${e.message}`);
    }
  }

  // 2. Sync from all connected accounts
  const { data: connectedAccounts } = await supabaseAdmin
    .from("connected_accounts")
    .select("email, access_token, refresh_token")
    .eq("user_id", userId);

  if (connectedAccounts && connectedAccounts.length > 0) {
    for (const account of connectedAccounts) {
      let token = account.access_token;

      try {
        const result = await syncFromAccount(token, userId);
        totalSynced += result.synced;
        totalAlerts += result.total;
      } catch (e: any) {
        // Token might be expired — try refreshing
        if (account.refresh_token) {
          const newToken = await refreshAccessToken(account.refresh_token);
          if (newToken) {
            // Update stored token
            await supabaseAdmin
              .from("connected_accounts")
              .update({ access_token: newToken })
              .eq("user_id", userId)
              .eq("email", account.email);

            try {
              const result = await syncFromAccount(newToken, userId);
              totalSynced += result.synced;
              totalAlerts += result.total;
            } catch (e2: any) {
              errors.push(`${account.email}: ${e2.message}`);
            }
          } else {
            errors.push(`${account.email}: token refresh failed`);
          }
        } else {
          errors.push(`${account.email}: ${e.message}`);
        }
      }
    }
  }

  return NextResponse.json({
    synced: totalSynced,
    total: totalAlerts,
    accounts: 1 + (connectedAccounts?.length ?? 0),
    errors: errors.length > 0 ? errors : undefined,
  });
}
