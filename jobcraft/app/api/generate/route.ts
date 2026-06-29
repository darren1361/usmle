import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateCoverLetter, generateTailoredResume } from "@/lib/ai";
import type { UserProfile } from "@/types/profile";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.email!;
  const { jobId } = await req.json();

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (jobErr || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profile not found. Please complete your profile first." }, { status: 400 });
  }

  await supabaseAdmin.from("jobs").update({ status: "generating" }).eq("id", jobId);

  const jobData = {
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.raw_description ?? `${job.title} at ${job.company}`,
  };

  const [coverLetter, tailoredResume] = await Promise.all([
    generateCoverLetter(jobData, profile as UserProfile),
    generateTailoredResume(jobData, profile as UserProfile),
  ]);

  const { data: application, error: appErr } = await supabaseAdmin
    .from("applications")
    .upsert(
      { user_id: userId, job_id: jobId, cover_letter: coverLetter, tailored_resume: tailoredResume, generated_at: new Date().toISOString() },
      { onConflict: "job_id" }
    )
    .select()
    .single();

  if (appErr) return NextResponse.json({ error: appErr.message }, { status: 500 });

  await supabaseAdmin.from("jobs").update({ status: "done" }).eq("id", jobId);

  return NextResponse.json({ applicationId: application.id, coverLetter, tailoredResume });
}
