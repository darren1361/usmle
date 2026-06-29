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

function getEmailBody(payload: any): string {
  if (!payload) return "";

  if (payload.body?.data) {
    const decoded = decodeBase64(payload.body.data);
    if (payload.mimeType === "text/html") return extractTextFromHtml(decoded);
    return decoded;
  }

  if (payload.parts) {
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) return extractTextFromHtml(decodeBase64(htmlPart.body.data));
    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart?.body?.data) return decodeBase64(textPart.body.data);
    for (const part of payload.parts) {
      const nested = getEmailBody(part);
      if (nested) return nested;
    }
  }

  return "";
}

function parseLinkedInAlert(body: string, subject: string): Pick<ParsedEmail, "title" | "company" | "location" | "jobUrl"> {
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

  return { title, company, location, jobUrl };
}

export async function fetchLinkedInAlerts(accessToken: string, maxResults = 50): Promise<ParsedEmail[]> {
  const gmail = getGmailClient(accessToken);

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: "from:jobalerts-noreply@linkedin.com",
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
        const body = getEmailBody(full.data.payload);
        const { title, company, location, jobUrl } = parseLinkedInAlert(body, subject);

        parsed.push({
          messageId: msg.id,
          title,
          company,
          location,
          jobUrl,
          emailDate: dateStr ? new Date(dateStr).toISOString() : null,
          rawDescription: body.slice(0, 3000),
        });
      } catch {
        // Skip malformed messages
      }
    })
  );

  return parsed;
}
