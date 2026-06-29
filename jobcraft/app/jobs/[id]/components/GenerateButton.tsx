"use client";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  "Analyzing job description…",
  "Writing cover letter…",
  "Tailoring resume…",
  "Finalizing documents…",
];

interface Props {
  jobId: string;
  onGenerated: (coverLetter: string, tailoredResume: any, applicationId: string) => void;
}

export function GenerateButton({ jobId, onGenerated }: Props) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);

    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 4000);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      onGenerated(data.coverLetter, data.tailoredResume, data.applicationId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      clearInterval(interval);
      setLoading(false);
      setStep(0);
    }
  };

  return (
    <div className="text-center">
      <Button size="lg" onClick={generate} disabled={loading} className="gap-2 px-8">
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {STEPS[step]}
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Generate Cover Letter &amp; Resume
          </>
        )}
      </Button>
      {!loading && (
        <p className="mt-2 text-xs text-gray-500">Uses your profile · powered by Gemini</p>
      )}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
