"use client";
import Link from "next/link";
import { MapPin, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Job, JobTag } from "@/types/job";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const TAG_LABELS: Record<Exclude<JobTag, null>, string> = {
  priority: "★ Priority",
  interested: "Interested",
  save_later: "Save Later",
  not_interested: "Not Interested",
  applied: "Applied",
};

const TAG_VARIANTS: Record<Exclude<JobTag, null>, any> = {
  priority: "priority",
  interested: "interested",
  save_later: "save_later",
  not_interested: "not_interested",
  applied: "applied",
};

const STATUS_VARIANTS: Record<string, any> = {
  new: "new",
  generating: "default",
  done: "generated",
  archived: "archived",
};

interface Props {
  job: Job;
  onTagChange?: (jobId: string, tag: JobTag) => void;
}

export function JobCard({ job, onTagChange }: Props) {
  const tags: JobTag[] = ["priority", "interested", "save_later", "not_interested", "applied"];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_VARIANTS[job.status] ?? "default"}>
              {job.status === "done" ? "Generated" : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Badge>
            {job.user_tag && (
              <Badge variant={TAG_VARIANTS[job.user_tag]}>
                {TAG_LABELS[job.user_tag]}
              </Badge>
            )}
          </div>
          <h3 className="mt-1 font-semibold text-gray-900 truncate">{job.title}</h3>
          <p className="text-sm text-gray-600">{job.company}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {job.location}
              </span>
            )}
            {job.email_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {formatDate(job.email_date)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Link href={`/jobs/${job.id}`}>
            <Button size="sm" variant={job.status === "done" ? "outline" : "default"}>
              {job.status === "done" ? "View Application" : "Generate →"}
            </Button>
          </Link>
          {onTagChange && (
            <select
              value={job.user_tag ?? ""}
              onChange={(e) => onTagChange(job.id, (e.target.value || null) as JobTag)}
              className="text-xs rounded border border-gray-200 px-1.5 py-1 text-gray-600 bg-white"
            >
              <option value="">— Tag —</option>
              {tags.map((t) => (
                <option key={t} value={t!}>{TAG_LABELS[t!]}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
