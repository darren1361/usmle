"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin, Calendar } from "lucide-react";
import { NavBar } from "@/components/NavBar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Job, JobTag } from "@/types/job";
import type { UserProfile } from "@/types/profile";
import { GenerateButton } from "./components/GenerateButton";
import { CoverLetterEditor } from "./components/CoverLetterEditor";
import { ResumeEditor } from "./components/ResumeEditor";
import { ExportButtons } from "./components/ExportButtons";

const TAG_LABELS: Record<Exclude<JobTag, null>, string> = {
  priority: "★ Priority",
  interested: "Interested",
  save_later: "Save Later",
  not_interested: "Not Interested",
  applied: "Applied",
};

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [application, setApplication] = useState<{ id: string; cover_letter: string; tailored_resume: Partial<UserProfile> } | null>(null);
  const [activeTab, setActiveTab] = useState<"cover_letter" | "resume">("cover_letter");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setJobId(p.id));
  }, [params]);

  useEffect(() => {
    if (!jobId) return;
    Promise.all([
      fetch(`/api/jobs/${jobId}`).then((r) => r.json()),
    ]).then(([jobData]) => {
      setJob(jobData);
      setLoading(false);
    });
  }, [jobId]);

  const handleGenerated = (coverLetter: string, tailoredResume: any, applicationId: string) => {
    setApplication({ id: applicationId, cover_letter: coverLetter, tailored_resume: tailoredResume });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="h-64 rounded-lg bg-gray-200 animate-pulse" />
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar />
        <main className="mx-auto max-w-4xl px-4 py-8 text-center text-gray-500">Job not found.</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
              <p className="text-gray-600 mt-0.5">{job.company}</p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                {job.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.location}</span>}
                {job.email_date && <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {formatDate(job.email_date)}</span>}
                {job.job_url && (
                  <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline">
                    <ExternalLink className="h-4 w-4" /> View on LinkedIn
                  </a>
                )}
              </div>
            </div>
            {job.user_tag && (
              <Badge variant={job.user_tag as any}>{TAG_LABELS[job.user_tag]}</Badge>
            )}
          </div>
        </div>

        {job.raw_description && (
          <details className="rounded-lg border border-gray-200 bg-white p-4">
            <summary className="cursor-pointer font-medium text-gray-700 text-sm">Job Description</summary>
            <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{job.raw_description}</p>
          </details>
        )}

        {!application ? (
          <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50 py-12 text-center">
            <GenerateButton jobId={job.id} onGenerated={handleGenerated} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
              <span className="text-sm font-medium text-gray-700">Download your documents</span>
              <ExportButtons applicationId={application.id} />
            </div>

            <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
              {(["cover_letter", "resume"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === tab ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {tab === "cover_letter" ? "Cover Letter" : "Resume"}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              {activeTab === "cover_letter" ? (
                <CoverLetterEditor applicationId={application.id} initial={application.cover_letter} />
              ) : (
                <ResumeEditor applicationId={application.id} resume={application.tailored_resume} />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
