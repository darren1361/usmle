import { google } from "googleapis";
import * as cheerio from "cheerio";
import type { ParsedEmail } from "@/types/job";

export function getGmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);
  $("script, style").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

function getEmailContent(payload: any): { html: string; text: string } {
  let html = "";
  let text = "";

  if (!payload) return { html, text };

  if (payload.body?.data) {
    const decoded = decodeBase64(payload.body.data);
    if (payload.mimeType === "text/html") {
      html = decoded;
      text = extractTextFromHtml(decoded);
    } else {
      text = decoded;
    }
  }

  if (payload.parts) {
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      html = decodeBase64(htmlPart.body.data);
      text = extractTextFromHtml(html);
    }
    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      text = decodeBase64(textPart.body.data);
    }

    if (!html) {
      for (const part of payload.parts) {
        const nested = getEmailContent(part);
        if (nested.html) {
          html = nested.html;
          if (nested.text) text = nested.text;
          break;
        }
      }
    }
  }

  return { html, text };
}

interface ParsedJob {
  title: string;
  company: string;
  location: string | null;
  jobUrl: string | null;
  source: "linkedin" | "indeed";
}

function parseLinkedInAlertHtml(html: string): ParsedJob[] {
  const $ = cheerio.load(html);
  const jobs: ParsedJob[] = [];

  $("a").each((i, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes("/jobs/view/") || href.includes("/comm/jobs/view/")) {
      const title = $(el).text().trim();
      if (!title) return;

      const tr = $(el).closest("tr");
      if (!tr.length) return;

      const nextTr = tr.next("tr");
      if (!nextTr.length) return;

      const p = nextTr.find("p");
      if (!p.length) return;

      const infoText = p.text().trim();
      const infoParts = infoText.split("·");
      const company = infoParts[0]?.trim() || "Unknown Company";
      const location = infoParts.slice(1).join("·")?.trim() || null;

      const cleanedUrl = href.replace("/comm/jobs/view/", "/jobs/view/").split("?")[0];

      // Avoid duplicates within the same email
      if (!jobs.some((j) => j.jobUrl === cleanedUrl)) {
        jobs.push({
          title,
          company,
          location,
          jobUrl: cleanedUrl,
          source: "linkedin",
        });
      }
    }
  });

  return jobs;
}

function parseLinkedInAlert(body: string, subject: string): ParsedJob {
  const subjectMatch = subject.match(/(?:New job|Job alert)[:\s]+(.+?)(?:\s+at\s+(.+))?$/i);
  const titleFromSubject = subjectMatch?.[1]?.trim() ?? "";
  const companyFromSubject = subjectMatch?.[2]?.trim() ?? "";

  const urlMatch = body.match(/https:\/\/www\.linkedin\.com\/jobs\/view\/\d+[^\s"<]*/);
  const jobUrl = urlMatch?.[0] ?? null;

  const locationMatch = body.match(/(?:Location|location)[:\s]+([^\n,]+)/);
  const location = locationMatch?.[1]?.trim() ?? null;

  const bodyTitleMatch = body.match(/(?:^|\n)([A-Z][^.\n]{10,80})(?:\n|at\s)/m);
  const title = titleFromSubject || bodyTitleMatch?.[1]?.trim() || "Unknown Position";
  const company = companyFromSubject || "Unknown Company";

  return { title, company, location, jobUrl, source: "linkedin" };
}

function parseIndeedAlertHtml(html: string): ParsedJob[] {
  const $ = cheerio.load(html);
  const jobs: ParsedJob[] = [];

  // Indeed job alerts typically have job cards with links to indeed.com/viewjob or indeed.com/rc/clk
  $("a").each((i, el) => {
    const href = $(el).attr("href") || "";
    if (
      href.includes("indeed.com/viewjob") ||
      href.includes("indeed.com/rc/clk") ||
      href.includes("indeed.com/job/")
    ) {
      // The job title is typically the link text
      const title = $(el).text().trim();
      if (!title || title.length < 3) return;

      // Try to find company and location from nearby elements
      let company = "Unknown Company";
      let location: string | null = null;

      // Walk up to the parent container and look for company/location text
      const container = $(el).closest("td, div, tr");
      if (container.length) {
        // Look for text after the title link — often company name
        const allText = container.text().trim();
        const afterTitle = allText.split(title).pop()?.trim() || "";

        // Common patterns: "Company Name - Location" or "Company Name\nLocation"
        const parts = afterTitle.split(/[\n\r-–—]/).map((s: string) => s.trim()).filter(Boolean);
        if (parts.length >= 1) company = parts[0] || "Unknown Company";
        if (parts.length >= 2) location = parts[1] || null;
      }

      const cleanedUrl = href.split("?")[0];

      if (!jobs.some((j) => j.jobUrl === cleanedUrl)) {
        jobs.push({
          title,
          company,
          location,
          jobUrl: href, // Keep full Indeed URL as it often has tracking params needed
          source: "indeed",
        });
      }
    }
  });

  return jobs;
}

function parseIndeedAlertText(body: string, subject: string): ParsedJob {
  const titleMatch = subject.match(/(?:new jobs?|jobs? alert)[:\s]*(.+)/i);
  const title = titleMatch?.[1]?.trim() || "Unknown Position";

  const urlMatch = body.match(/https?:\/\/[^\s]*indeed\.com\/[^\s"<]+/);
  const jobUrl = urlMatch?.[0] ?? null;

  return { title, company: "Unknown Company", location: null, jobUrl, source: "indeed" };
}

/**
 * Detect email source from sender address
 */
function detectSource(fromHeader: string): "linkedin" | "indeed" | null {
  const from = fromHeader.toLowerCase();
  if (from.includes("linkedin.com")) return "linkedin";
  if (from.includes("indeed.com")) return "indeed";
  return null;
}

export async function fetchJobAlerts(accessToken: string, maxResults = 50): Promise<ParsedEmail[]> {
  const gmail = getGmailClient(accessToken);

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: "from:jobalerts-noreply@linkedin.com OR from:alert@indeed.com OR from:no-reply@indeed.com",
    maxResults,
  });

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) return [];

  const parsed: ParsedEmail[] = [];

  await Promise.all(
    messages.map(async (msg) => {
      if (!msg.id) return;
      try {
        const full = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });

        const headers = full.data.payload?.headers ?? [];
        const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
        const dateStr = headers.find((h) => h.name === "Date")?.value ?? null;
        const fromHeader = headers.find((h) => h.name === "From")?.value ?? "";

        const source = detectSource(fromHeader);
        if (!source) return; // Skip non-job emails

        const { html, text } = getEmailContent(full.data.payload);

        let jobs: ParsedJob[] = [];

        if (source === "linkedin") {
          if (html) {
            jobs = parseLinkedInAlertHtml(html);
          }
          if (jobs.length === 0 && text) {
            const single = parseLinkedInAlert(text, subject);
            jobs.push(single);
          }
        } else if (source === "indeed") {
          if (html) {
            jobs = parseIndeedAlertHtml(html);
          }
          if (jobs.length === 0 && text) {
            const single = parseIndeedAlertText(text, subject);
            jobs.push(single);
          }
        }

        jobs.forEach((job, index) => {
          parsed.push({
            messageId: `${msg.id}_${index}`,
            title: job.title,
            company: job.company,
            location: job.location,
            jobUrl: job.jobUrl,
            emailDate: dateStr ? new Date(dateStr).toISOString() : null,
            rawDescription: text.slice(0, 3000),
            source: job.source,
          });
        });
      } catch (e) {
        // Skip malformed messages
      }
    })
  );

  return parsed;
}

// Keep backward compatibility
export const fetchLinkedInAlerts = fetchJobAlerts;
