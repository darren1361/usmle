import type { UserProfile } from "./profile";

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  cover_letter: string | null;
  tailored_resume: Partial<UserProfile> | null;
  generated_at: string;
  last_edited_at: string | null;
}

export interface VaultDocument {
  id: string;
  user_id: string;
  name: string;
  doc_type: "resume" | "cover_letter" | "reference" | "other";
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}
