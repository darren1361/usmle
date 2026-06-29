"use client";
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  applicationId: string;
}

type DocType = "cover_letter" | "resume";
type Format = "pdf" | "docx";

export function ExportButtons({ applicationId }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const download = async (document: DocType, format: Format) => {
    const key = `${document}_${format}`;
    setLoading(key);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, document, format }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document_elem();
      a.href = url;
      a.download = `${document}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(null);
    }
  };

  const document_elem = () => window.document.createElement("a");

  const btn = (doc: DocType, fmt: Format, label: string) => {
    const key = `${doc}_${fmt}`;
    return (
      <Button
        key={key}
        size="sm"
        variant="outline"
        onClick={() => download(doc, fmt)}
        disabled={loading === key}
        className="gap-1.5"
      >
        {loading === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
        {label}
      </Button>
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {btn("cover_letter", "pdf", "Cover Letter PDF")}
      {btn("cover_letter", "docx", "Cover Letter Word")}
      {btn("resume", "pdf", "Resume PDF")}
      {btn("resume", "docx", "Resume Word")}
    </div>
  );
}
