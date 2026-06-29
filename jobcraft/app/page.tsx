import Link from "next/link";
import { Briefcase, Mail, Sparkles, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="max-w-2xl text-center">
        <div className="mb-6 flex items-center justify-center gap-2 text-indigo-600 text-2xl font-bold">
          <Briefcase className="h-7 w-7" />
          JobCraft
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Land your next job — faster.
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          AI-powered cover letters and resumes tailored to every job, pulled straight from your Gmail inbox.
        </p>
        <div className="mt-8">
          <Link href="/signin">
            <Button size="lg" className="gap-2 text-base px-8">
              Get Started — Sign in with Google
            </Button>
          </Link>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { icon: Mail, title: "Sync Gmail", desc: "Automatically pull LinkedIn job alerts from your inbox" },
            { icon: Sparkles, title: "AI Writes Your Docs", desc: "Gemini generates a custom cover letter and tailored resume for each job" },
            { icon: FileDown, title: "Download PDF or Word", desc: "Export polished, ready-to-send documents in seconds" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-left shadow-sm">
              <Icon className="mb-3 h-6 w-6 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="mt-1 text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
