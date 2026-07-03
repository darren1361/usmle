"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Search, Plus } from "lucide-react";
import { NavBar } from "@/components/NavBar";
import { JobCard } from "@/components/JobCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Job, JobTag, JobStatus } from "@/types/job";

const STATUS_TABS: { label: string; value: JobStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Generated", value: "done" },
  { label: "Archived", value: "archived" },
];

const TAG_FILTERS: { label: string; value: JobTag | "all" }[] = [
  { label: "All Tags", value: "all" },
  { label: "★ Priority", value: "priority" },
  { label: "Interested", value: "interested" },
  { label: "Save Later", value: "save_later" },
  { label: "Not Interested", value: "not_interested" },
  { label: "Applied", value: "applied" },
];

const SOURCE_FILTERS: { label: string; value: string }[] = [
  { label: "All Sources", value: "all" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "Indeed", value: "indeed" },
];

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [tagFilter, setTagFilter] = useState<JobTag | "all">("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [linkedAccounts, setLinkedAccounts] = useState<{id: string; email: string}[]>([]);

  const loadJobs = useCallback(async () => {
    const res = await fetch("/api/emails");
    if (res.ok) setJobs(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  useEffect(() => {
    fetch("/api/auth/linked-accounts")
      .then((r) => r.ok ? r.json() : [])
      .then(setLinkedAccounts)
      .catch(() => {});
  }, []);

  const syncEmails = async () => {
    setSyncing(true);
    await fetch("/api/emails/sync", { method: "POST" });
    await loadJobs();
    setSyncing(false);
  };

  const handleTagChange = async (jobId: string, tag: JobTag) => {
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, user_tag: tag } : j));
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_tag: tag }),
    });
  };

  const locations = ["all", ...Array.from(new Set(jobs.map((j) => j.location).filter(Boolean)))];

  const filtered = jobs.filter((j) => {
    if (search && !`${j.title} ${j.company}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    if (tagFilter !== "all" && j.user_tag !== tagFilter) return false;
    if (locationFilter !== "all" && j.location !== locationFilter) return false;
    if (sourceFilter !== "all" && j.source !== sourceFilter) return false;
    if (dateFilter) {
      const jobDate = j.email_date ? new Date(j.email_date) : new Date(j.created_at);
      const year = jobDate.getFullYear();
      const month = String(jobDate.getMonth() + 1).padStart(2, '0');
      const day = String(jobDate.getDate()).padStart(2, '0');
      const jobDateString = `${year}-${month}-${day}`;
      
      if (jobDateString !== dateFilter) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Alerts</h1>
            <p className="text-sm text-gray-500">
              {jobs.length} jobs synced
              {linkedAccounts.length > 0 && ` from ${1 + linkedAccounts.length} accounts`}
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/api/auth/link-gmail">
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Gmail
              </Button>
            </a>
            <Button onClick={syncEmails} disabled={syncing} variant="outline" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync All"}
            </Button>
          </div>
        </div>

        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search title or company…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700"
            >
              {locations.map((l) => (
                <option key={l ?? "all"} value={l ?? "all"}>{l === "all" ? "All Locations" : l}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setStatusFilter(t.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === t.value
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t.label}
              </button>
            ))}
            <span className="text-gray-300">|</span>
            {SOURCE_FILTERS.map((t) => (
              <button
                key={t.value}
                onClick={() => setSourceFilter(t.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  sourceFilter === t.value
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t.label}
              </button>
            ))}
            <span className="text-gray-300">|</span>
            {TAG_FILTERS.map((t) => (
              <button
                key={String(t.value)}
                onClick={() => setTagFilter(t.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  tagFilter === t.value
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
            {jobs.length === 0
              ? <><span>No job alerts yet. Click </span><strong>Sync Gmail</strong><span> to pull your LinkedIn job alerts.</span></>
              : "No jobs match your filters."}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} onTagChange={handleTagChange} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
