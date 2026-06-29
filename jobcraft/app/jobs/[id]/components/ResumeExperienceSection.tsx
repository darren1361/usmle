"use client";
import { useState } from "react";
import { Pencil, X, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { WorkExperience } from "@/types/profile";

interface Props {
  applicationId: string;
  experiences: WorkExperience[];
  onChange: (updated: WorkExperience[]) => void;
}

export function ResumeExperienceSection({ applicationId, experiences, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkExperience | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (exp: WorkExperience) => {
    setEditingId(exp.id);
    setDraft({ ...exp });
  };

  const cancelEdit = () => { setEditingId(null); setDraft(null); };

  const saveEntry = async () => {
    if (!draft) return;
    setSaving(true);
    const updated = experiences.map((e) => (e.id === draft.id ? draft : e));
    onChange(updated);
    await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tailored_resume: { work_experience: updated } }),
    });
    setSaving(false);
    setEditingId(null);
    setDraft(null);
  };

  const updateBullet = (idx: number, val: string) => {
    if (!draft) return;
    const achievements = [...draft.achievements];
    achievements[idx] = val;
    setDraft({ ...draft, achievements });
  };

  const addBullet = () => {
    if (!draft) return;
    setDraft({ ...draft, achievements: [...draft.achievements, ""] });
  };

  const removeBullet = (idx: number) => {
    if (!draft) return;
    setDraft({ ...draft, achievements: draft.achievements.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Experience</h3>
      {experiences.map((exp) =>
        editingId === exp.id && draft ? (
          <div key={exp.id} className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Job Title</Label>
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Company</Label>
                <Input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} placeholder="e.g. 2021-01" className="mt-1" />
              </div>
              <div>
                <Label>End Date</Label>
                <Input value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} placeholder="e.g. 2024-06 or Present" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Achievements / Bullets</Label>
              <div className="mt-1 space-y-2">
                {draft.achievements.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="mt-2 text-gray-400 shrink-0">•</span>
                    <Textarea
                      value={b}
                      onChange={(e) => updateBullet(i, e.target.value)}
                      rows={2}
                      className="flex-1 text-sm"
                    />
                    <Button size="icon" variant="ghost" onClick={() => removeBullet(i)} className="shrink-0 mt-1">
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={addBullet} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add bullet
                </Button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={cancelEdit}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={saveEntry} disabled={saving} className="gap-1">
                <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save This Entry"}
              </Button>
            </div>
          </div>
        ) : (
          <div key={exp.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{exp.title} — {exp.company}</p>
                <p className="text-xs text-gray-500">{exp.start_date} – {exp.end_date}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => startEdit(exp)} title="Edit this entry">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ul className="mt-2 space-y-1">
              {exp.achievements.map((b, i) => (
                <li key={i} className="text-sm text-gray-700">• {b}</li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
}
