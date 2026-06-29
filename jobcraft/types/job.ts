export type JobTag =
  | "interested"
  | "priority"
  | "save_later"
  | "not_interested"
  | "applied"
  | null;

export type JobStatus = "new" | "generating" | "done" | "archived";

export interface Job {
  id: string;
  user_id: string;
  gmail_message_id: string;
  title: string;
  company: string;
  location: string | null;
  job_url: string | null;
  email_date: string | null;
  raw_description: string | null;
  status: JobStatus;
  user_tag: JobTag;
  created_at: string;
}

export interface ParsedEmail {
  messageId: string;
  title: string;
  company: string;
  location: string | null;
  jobUrl: string | null;
  emailDate: string | null;
  rawDescription: string | null;
}
