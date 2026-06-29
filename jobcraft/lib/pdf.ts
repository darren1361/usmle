import type { UserProfile } from "@/types/profile";

export interface CoverLetterData {
  name: string;
  email: string;
  phone: string;
  location: string;
  coverLetter: string;
  jobTitle: string;
  company: string;
}

export interface ResumeData {
  profile: Partial<UserProfile>;
}

export function shapeCoverLetterData(
  profile: UserProfile,
  coverLetter: string,
  jobTitle: string,
  company: string
): CoverLetterData {
  return {
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    coverLetter,
    jobTitle,
    company,
  };
}

export function shapeResumeData(tailoredResume: Partial<UserProfile>): ResumeData {
  return { profile: tailoredResume };
}
