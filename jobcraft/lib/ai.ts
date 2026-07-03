import { GoogleGenerativeAI } from "@google/generative-ai";
import type { UserProfile } from "@/types/profile";

const MODEL = "gemini-2.0-flash";

function getClient() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
}

export async function generateCoverLetter(
  job: { title: string; company: string; location: string | null; description: string },
  profile: UserProfile
): Promise<string> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: MODEL });

  const prompt = `You are an expert career coach. Write a compelling, personalized cover letter that sounds like it was written by a real person, not AI. Avoid clichés like "I am excited to apply", "I am a passionate individual", or overly formal phrasing. Use natural, confident, first-person voice.

Job: ${job.title} at ${job.company}${job.location ? ` (${job.location})` : ""}
Description: ${job.description}

Candidate:
Name: ${profile.name}
Summary: ${profile.summary}
Experience: ${JSON.stringify(profile.work_experience)}
Skills: ${profile.skills.join(", ")}

Write a 3-paragraph cover letter (~300 words). Address it to the Hiring Manager.
Para 1: Why this specific role at this company genuinely interests the candidate — be specific to the company/role.
Para 2: 1-2 specific achievements from their experience most relevant to this job, with concrete results where possible.
Para 3: Brief, confident closing with a call to action.

Do NOT use buzzwords like "passionate", "dynamic", "synergy", "leverage", or AI-sounding filler phrases.
Format: plain text only, no markdown. Start directly with "Dear Hiring Manager,".`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateTailoredResume(
  job: { title: string; company: string; description: string },
  profile: UserProfile
): Promise<Partial<UserProfile>> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: MODEL });

  const prompt = `You are a resume expert. Tailor the candidate's resume for this specific job. Keep all data factual — do not invent experience, titles, dates, or achievements.

Job: ${job.title} at ${job.company}
Description: ${job.description}

Master Resume (JSON):
${JSON.stringify(profile, null, 2)}

Return a JSON object with this exact shape:
{
  "summary": "string — rewritten to target this specific role",
  "work_experience": [ same array as input but with achievements reordered to lead with most relevant items for this job ],
  "education": [ same as input ],
  "skills": [ same skill strings but reordered: most relevant to this job first ]
}

Rules:
- Max 2 pages worth of content (~700 words total across all sections)
- Do NOT add skills or achievements that aren't in the original
- Return ONLY valid JSON, no markdown, no explanation`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonStr = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(jsonStr) as Partial<UserProfile>;
}

export async function parseResumeText(resumeText: string): Promise<Partial<UserProfile>> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: MODEL });

  const prompt = `Extract structured resume data from the following text. Return ONLY valid JSON with no markdown or explanation.

Resume text:
${resumeText.slice(0, 8000)}

Return this exact JSON shape:
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "linkedin_url": "string",
  "website_url": "string",
  "summary": "string",
  "work_experience": [
    {
      "id": "generate a short unique id like exp_1",
      "title": "string",
      "company": "string",
      "start_date": "string (e.g. 2021-01)",
      "end_date": "string (e.g. 2024-06 or Present)",
      "achievements": ["bullet point string", ...]
    }
  ],
  "education": [
    {
      "id": "generate a short unique id like edu_1",
      "degree": "string",
      "institution": "string",
      "year": "string",
      "gpa": "string or empty"
    }
  ],
  "skills": ["skill1", "skill2", ...]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonStr = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(jsonStr) as Partial<UserProfile>;
}
