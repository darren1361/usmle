"use client";
import { useEffect, useState, useRef } from "react";
import { FileText, Trash2, Upload, Loader2 } from "lucide-react";
import { NavBar } from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { VaultDocument } from "@/types/application";

const DOC_TYPES = ["all", "resume", "cover_letter", "reference", "other"] as const;
type DocTypeFilter = typeof DOC_TYPES[number];

const TYPE_LABELS: Record<string, string> = {
  resume: "Resume",
  cover_letter: "Cover Letter",
  reference: "Reference",
  other: "Other",
};

export default function VaultPage() {
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [filter, setFilter] = useState<DocTypeFilter>("all");
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState("other");
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/vault").then((r) => r.json()).then(setDocs);
  }, []);

  const upload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("doc_type", uploadType);
    const res = await fetch("/api/vault", { method: "POST", body: fd });
    if (res.ok) {
      const doc = await res.json();
      setDocs((prev) => [doc, ...prev]);
    }
    setUploading(false);
  };

  const deleteDoc = async (id: string) => {
    setDeleting(id);
    await fetch(`/api/vault/${id}`, { method: "DELETE" });
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setDeleting(null);
  };

  const filtered = filter === "all" ? docs : docs.filter((d) => d.doc_type === filter);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Vault</h1>
          <p className="text-sm text-gray-500 mt-1">Store your existing resumes, cover letters, and reference documents.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
            >
              {DOC_TYPES.filter((t) => t !== "all").map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload Document"}
            </Button>
            <span className="text-xs text-gray-400">PDF, Word, or TXT — max 10MB</span>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {DOC_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === t ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t === "all" ? "All" : TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
            {docs.length === 0 ? "No documents uploaded yet." : "No documents match this filter."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-indigo-400 shrink-0" />
                  <div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-gray-900 hover:text-indigo-600 text-sm">{doc.name}</a>
                    <p className="text-xs text-gray-500">{TYPE_LABELS[doc.doc_type] ?? doc.doc_type} · {formatDate(doc.created_at)}</p>
                  </div>
                </div>
                <Button
                  size="icon" variant="ghost"
                  onClick={() => deleteDoc(doc.id)}
                  disabled={deleting === doc.id}
                  className="text-gray-400 hover:text-red-500"
                >
                  {deleting === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
