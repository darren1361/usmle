"use client";
import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { NavBar } from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { UserProfile, WorkExperience, Education } from "@/types/profile";

const emptyExp = (): WorkExperience => ({
  id: `exp_${Date.now()}`,
  title: "",
  company: "",
  start_date: "",
  end_date: "",
  achievements: [""],
});

const emptyEdu = (): Education => ({
  id: `edu_${Date.now()}`,
  degree: "",
  institution: "",
  year: "",
  gpa: "",
});

export default function ProfilePage() {
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    name: "", email: "", phone: "", location: "", linkedin_url: "", website_url: "",
    summary: "", work_experience: [], education: [], skills: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((data) => {
      if (data) setProfile(data);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const uploadResume = async (file: File) => {
    setParsing(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/profile/parse", { method: "POST", body: fd });
    if (res.ok) {
      const parsed = await res.json();
      setProfile((p) => ({ ...p, ...parsed }));
    }
    setParsing(false);
  };

  const setField = (field: keyof UserProfile, val: any) =>
    setProfile((p) => ({ ...p, [field]: val }));

  const updateExp = (id: string, patch: Partial<WorkExperience>) =>
    setField("work_experience", (profile.work_experience ?? []).map((e) => e.id === id ? { ...e, ...patch } : e));

  const removeExp = (id: string) =>
    setField("work_experience", (profile.work_experience ?? []).filter((e) => e.id !== id));

  const updateEdu = (id: string, patch: Partial<Education>) =>
    setField("education", (profile.education ?? []).map((e) => e.id === id ? { ...e, ...patch } : e));

  const removeEdu = (id: string) =>
    setField("education", (profile.education ?? []).filter((e) => e.id !== id));

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s) return;
    setField("skills", [...(profile.skills ?? []), s]);
    setSkillInput("");
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><NavBar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="h-64 rounded-lg bg-gray-200 animate-pulse" />
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">My Profile — Master Resume</h1>

        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 py-8 cursor-pointer hover:bg-indigo-100 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {parsing ? (
            <><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /><p className="text-sm text-indigo-600">Extracting resume data…</p></>
          ) : (
            <><Upload className="h-6 w-6 text-indigo-500" />
            <p className="font-medium text-indigo-700">Upload existing resume (PDF or Word)</p>
            <p className="text-xs text-gray-500">AI will extract and pre-fill the form below</p></>
          )}
          <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadResume(f); }} />
        </div>

        <p className="text-center text-sm text-gray-400">— or fill in manually —</p>

        <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Contact Information</h2>
          <div className="grid grid-cols-2 gap-4">
            {(["name", "email", "phone", "location", "linkedin_url", "website_url"] as const).map((f) => (
              <div key={f}>
                <Label>{f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</Label>
                <Input className="mt-1" value={(profile as any)[f] ?? ""} onChange={(e) => setField(f, e.target.value)} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Professional Summary</h2>
          <Textarea rows={4} value={profile.summary ?? ""} onChange={(e) => setField("summary", e.target.value)} placeholder="A brief summary of your professional background…" />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Work Experience</h2>
            <Button size="sm" variant="outline" onClick={() => setField("work_experience", [...(profile.work_experience ?? []), emptyExp()])} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Entry
            </Button>
          </div>
          {(profile.work_experience ?? []).map((exp) => (
            <div key={exp.id} className="rounded-lg border border-gray-100 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Job Title</Label><Input className="mt-1" value={exp.title} onChange={(e) => updateExp(exp.id, { title: e.target.value })} /></div>
                <div><Label>Company</Label><Input className="mt-1" value={exp.company} onChange={(e) => updateExp(exp.id, { company: e.target.value })} /></div>
                <div><Label>Start Date</Label><Input className="mt-1" value={exp.start_date} placeholder="e.g. 2021-01" onChange={(e) => updateExp(exp.id, { start_date: e.target.value })} /></div>
                <div><Label>End Date</Label><Input className="mt-1" value={exp.end_date} placeholder="e.g. 2024-06 or Present" onChange={(e) => updateExp(exp.id, { end_date: e.target.value })} /></div>
              </div>
              <div>
                <Label>Achievements</Label>
                <div className="mt-1 space-y-2">
                  {exp.achievements.map((b, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="mt-2 text-gray-400">•</span>
                      <Textarea rows={2} className="flex-1 text-sm" value={b} onChange={(e) => {
                        const a = [...exp.achievements]; a[i] = e.target.value;
                        updateExp(exp.id, { achievements: a });
                      }} />
                      <Button size="icon" variant="ghost" onClick={() => updateExp(exp.id, { achievements: exp.achievements.filter((_, j) => j !== i) })}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => updateExp(exp.id, { achievements: [...exp.achievements, ""] })} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add bullet
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => removeExp(exp.id)} className="text-red-500 gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> Remove entry
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Education</h2>
            <Button size="sm" variant="outline" onClick={() => setField("education", [...(profile.education ?? []), emptyEdu()])} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Entry
            </Button>
          </div>
          {(profile.education ?? []).map((edu) => (
            <div key={edu.id} className="rounded-lg border border-gray-100 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Degree</Label><Input className="mt-1" value={edu.degree} onChange={(e) => updateEdu(edu.id, { degree: e.target.value })} /></div>
                <div><Label>Institution</Label><Input className="mt-1" value={edu.institution} onChange={(e) => updateEdu(edu.id, { institution: e.target.value })} /></div>
                <div><Label>Year</Label><Input className="mt-1" value={edu.year} onChange={(e) => updateEdu(edu.id, { year: e.target.value })} /></div>
                <div><Label>GPA (optional)</Label><Input className="mt-1" value={edu.gpa ?? ""} onChange={(e) => updateEdu(edu.id, { gpa: e.target.value })} /></div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => removeEdu(edu.id)} className="text-red-500 gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> Remove entry
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {(profile.skills ?? []).map((s) => (
              <span key={s} className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                {s}
                <button onClick={() => setField("skills", (profile.skills ?? []).filter((x) => x !== s))} className="text-indigo-400 hover:text-red-500">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} placeholder="Add a skill…"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
            <Button variant="outline" onClick={addSkill}>Add</Button>
          </div>
        </section>

        <div className="flex justify-end pb-8">
          <Button size="lg" onClick={save} disabled={saving} className="px-8">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : saved ? "✓ Saved!" : "Save Profile"}
          </Button>
        </div>
      </main>
    </div>
  );
}
