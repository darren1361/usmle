"use client";
import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ResumeExperienceSection } from "./ResumeExperienceSection";
import type { UserProfile, WorkExperience } from "@/types/profile";

interface Props {
  applicationId: string;
  resume: Partial<UserProfile>;
}

export function ResumeEditor({ applicationId, resume }: Props) {
  const [data, setData] = useState(resume);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(resume.summary ?? "");
  const [savingSection, setSavingSection] = useState<string | null>(null);

  const patchResume = async (patch: Partial<UserProfile>) => {
    const updated = { ...data, ...patch };
    setData(updated);
    await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tailored_resume: updated }),
    });
  };

  const saveSummary = async () => {
    setSavingSection("summary");
    await patchResume({ summary: summaryDraft });
    setSavingSection(null);
    setEditingSummary(false);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Summary</h3>
          {editingSummary ? (
            <Button size="sm" onClick={saveSummary} disabled={savingSection === "summary"} className="gap-1">
              <Check className="h-3.5 w-3.5" /> {savingSection === "summary" ? "Saving…" : "Save"}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditingSummary(true)} className="gap-1">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
        {editingSummary ? (
          <Textarea
            value={summaryDraft}
            onChange={(e) => setSummaryDraft(e.target.value)}
            rows={4}
            className="text-sm"
            autoFocus
          />
        ) : (
          <p className="text-sm text-gray-700 rounded-md border border-gray-100 bg-gray-50 p-3">
            {data.summary ?? <span className="text-gray-400 italic">No summary</span>}
          </p>
        )}
      </div>

      <ResumeExperienceSection
        applicationId={applicationId}
        experiences={(data.work_experience ?? []) as WorkExperience[]}
        onChange={(updated) => setData((prev) => ({ ...prev, work_experience: updated }))}
      />

      <div className="space-y-2">
        <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Education</h3>
        {(data.education ?? []).map((edu: any) => (
          <div key={edu.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <p className="font-medium text-gray-900">{edu.degree}</p>
            <p className="text-gray-600">{edu.institution} · {edu.year}{edu.gpa ? ` · GPA: ${edu.gpa}` : ""}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Skills</h3>
        <div className="flex flex-wrap gap-2">
          {(data.skills ?? []).map((skill: string) => (
            <span key={skill} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              {skill}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
