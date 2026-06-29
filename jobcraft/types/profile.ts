export interface WorkExperience {
  id: string;
  title: string;
  company: string;
  start_date: string;
  end_date: string;
  achievements: string[];
}

export interface Education {
  id: string;
  degree: string;
  institution: string;
  year: string;
  gpa?: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string;
  website_url: string;
  summary: string;
  work_experience: WorkExperience[];
  education: Education[];
  skills: string[];
  created_at: string;
  updated_at: string;
}
