"use client";
import { useState, useRef } from "react";
import { Pencil, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  applicationId: string;
  initial: string;
}

export function CoverLetterEditor({ applicationId, initial }: Props) {
  const [text, setText] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const save = async (value: string) => {
    setSaving(true);
    await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cover_letter: value }),
    });
    setSaving(false);
  };

  const handleChange = (val: string) => {
    setText(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(val), 2000);
  };

  const handleSave = async () => {
    clearTimeout(timerRef.current);
    await save(text);
    setEditing(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Cover Letter</h2>
        <div className="flex gap-2">
          {saving && <span className="text-xs text-gray-400 self-center">Saving…</span>}
          {editing ? (
            <Button size="sm" onClick={handleSave} className="gap-1">
              <Check className="h-3.5 w-3.5" /> Save
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => { setText(initial); setEditing(false); }} title="Revert to AI draft">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {editing ? (
        <Textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          className="min-h-[320px] font-mono text-sm"
          autoFocus
        />
      ) : (
        <div className="whitespace-pre-wrap rounded-md border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
          {text}
        </div>
      )}
    </div>
  );
}
