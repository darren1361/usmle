import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // primary user email
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?link_error=cancelled", req.url)
    );
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/link-gmail/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Token exchange failed:", errBody);
      return NextResponse.redirect(
        new URL("/dashboard?link_error=token_failed", req.url)
      );
    }

    const tokens = await tokenRes.json();

    // Get the email of the linked account
    const userinfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const userinfo = await userinfoRes.json();
    const linkedEmail = userinfo.email;

    if (!linkedEmail) {
      return NextResponse.redirect(
        new URL("/dashboard?link_error=no_email", req.url)
      );
    }

    // Save to connected_accounts (upsert to handle re-linking)
    const { error: dbError } = await supabaseAdmin
      .from("connected_accounts")
      .upsert(
        {
          user_id: state,
          email: linkedEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
        },
        { onConflict: "user_id,email" }
      );

    if (dbError) {
      console.error("DB save failed:", dbError);
      return NextResponse.redirect(
        new URL("/dashboard?link_error=db_failed", req.url)
      );
    }

    return NextResponse.redirect(
      new URL(`/dashboard?linked=${encodeURIComponent(linkedEmail)}`, req.url)
    );
  } catch (err) {
    console.error("Link Gmail callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?link_error=unknown", req.url)
    );
  }
}
