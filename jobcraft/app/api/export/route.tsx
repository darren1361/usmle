import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { applicationId, document: docType, format } = await req.json();
  const userId = session.user.email!;

  const { data: app, error } = await supabaseAdmin
    .from("applications")
    .select("*, jobs(*)")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .single();

  if (error || !app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (format === "docx") {
    const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import("docx");

    let doc: InstanceType<typeof Document>;

    if (docType === "cover_letter") {
      const lines = (app.cover_letter ?? "").split("\n").filter(Boolean);
      doc = new Document({
        sections: [{
          children: [
            new Paragraph({ text: profile?.name ?? "", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: `${profile?.email ?? ""} | ${profile?.phone ?? ""} | ${profile?.location ?? ""}` }),
            new Paragraph({ text: "" }),
            ...lines.map((line: string) => new Paragraph({ children: [new TextRun(line)] })),
          ],
        }],
      });
    } else {
      const resume = app.tailored_resume ?? {};
      const children: any[] = [
        new Paragraph({ text: profile?.name ?? resume.name ?? "", heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `${profile?.email ?? ""} | ${profile?.phone ?? ""} | ${profile?.location ?? ""}` }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: resume.summary ?? "" }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_2 }),
      ];
      for (const exp of resume.work_experience ?? []) {
        children.push(new Paragraph({ text: `${exp.title} — ${exp.company} (${exp.start_date} – ${exp.end_date})`, bold: true } as any));
        for (const bullet of exp.achievements ?? []) {
          children.push(new Paragraph({ text: `• ${bullet}` }));
        }
        children.push(new Paragraph({ text: "" }));
      }
      children.push(new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_2 }));
      for (const edu of resume.education ?? []) {
        children.push(new Paragraph({ text: `${edu.degree} — ${edu.institution} (${edu.year})` }));
      }
      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: (resume.skills ?? []).join(", ") }));

      doc = new Document({ sections: [{ children }] });
    }

    const buffer = await Packer.toBuffer(doc);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${docType}.docx"`,
      },
    });
  }

  const { renderToBuffer, Document: PdfDoc, Page, Text, View, StyleSheet } = await import("@react-pdf/renderer");

  const styles = StyleSheet.create({
    page: { fontFamily: "Helvetica", fontSize: 11, padding: 40, color: "#111827" },
    name: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    meta: { fontSize: 10, color: "#6B7280", marginBottom: 16 },
    section: { marginBottom: 12 },
    heading: { fontSize: 13, fontFamily: "Helvetica-Bold", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 2, marginBottom: 6 },
    expTitle: { fontFamily: "Helvetica-Bold", fontSize: 11 },
    bullet: { fontSize: 10, marginLeft: 10, marginBottom: 2 },
    body: { fontSize: 11, lineHeight: 1.6 },
  });

  let pdfEl;

  if (docType === "cover_letter") {
    pdfEl = (
      <PdfDoc>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.name}>{profile?.name ?? ""}</Text>
            <Text style={styles.meta}>{profile?.email ?? ""} | {profile?.phone ?? ""} | {profile?.location ?? ""}</Text>
          </View>
          <View style={styles.section}>
            {(app.cover_letter ?? "").split("\n").filter(Boolean).map((line: string, i: number) => (
              <Text key={i} style={styles.body}>{line}</Text>
            ))}
          </View>
        </Page>
      </PdfDoc>
    );
  } else {
    const resume = app.tailored_resume ?? {};
    pdfEl = (
      <PdfDoc>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.name}>{profile?.name ?? resume.name ?? ""}</Text>
            <Text style={styles.meta}>{profile?.email ?? ""} | {profile?.phone ?? ""} | {profile?.location ?? ""}</Text>
          </View>
          {resume.summary && (
            <View style={styles.section}>
              <Text style={styles.heading}>Summary</Text>
              <Text style={styles.body}>{resume.summary}</Text>
            </View>
          )}
          {(resume.work_experience ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.heading}>Experience</Text>
              {(resume.work_experience ?? []).map((exp: any, i: number) => (
                <View key={i} style={{ marginBottom: 8 }}>
                  <Text style={styles.expTitle}>{exp.title} — {exp.company} ({exp.start_date} – {exp.end_date})</Text>
                  {(exp.achievements ?? []).map((b: string, j: number) => (
                    <Text key={j} style={styles.bullet}>• {b}</Text>
                  ))}
                </View>
              ))}
            </View>
          )}
          {(resume.education ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.heading}>Education</Text>
              {(resume.education ?? []).map((edu: any, i: number) => (
                <Text key={i} style={styles.body}>{edu.degree} — {edu.institution} ({edu.year})</Text>
              ))}
            </View>
          )}
          {(resume.skills ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.heading}>Skills</Text>
              <Text style={styles.body}>{(resume.skills ?? []).join(", ")}</Text>
            </View>
          )}
        </Page>
      </PdfDoc>
    );
  }

  const pdfBuffer = await renderToBuffer(pdfEl);
  return new NextResponse(new Uint8Array(pdfBuffer as Buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${docType}.pdf"`,
    },
  });
}
