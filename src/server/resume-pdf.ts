// Resume PDF export (README §14) with four templates.

import PDFDocument from "pdfkit";
import type { ResumeSection } from "@/db/schema";

export type ResumeData = {
  template: "classic" | "modern" | "compact" | "executive";
  name: string;
  headline: string | null;
  contact: string[]; // masked email, location, links — never a phone number
  summary: string | null;
  skills: string[];
  languages: string[];
  sections: ResumeSection[];
  experiences: { title: string; company: string; location: string | null; period: string; description: string | null }[];
  educations: { degree: string; institution: string; period: string; grade: string | null }[];
  certifications: { name: string; issuer: string | null; year: number | null }[];
  projects: { name: string; description: string | null; url: string | null }[];
};

const THEMES = {
  classic: { font: "Times-Roman", bold: "Times-Bold", italic: "Times-Italic", accent: "#111827", size: 11, headerBand: null as string | null, align: "center" as const },
  modern: { font: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique", accent: "#4338ca", size: 10.5, headerBand: null as string | null, align: "left" as const },
  compact: { font: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique", accent: "#0f766e", size: 9.5, headerBand: null as string | null, align: "left" as const },
  executive: { font: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique", accent: "#b45309", size: 10.5, headerBand: "#111827", align: "left" as const },
};

/** Standard PDF fonts use WinAnsi encoding — map or drop characters outside it. */
function safe(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/₹/g, "Rs. ")
    .replace(/[✓✔]/g, "")
    .replace(/[^\u0000-ÿ–—‘’“”•…€]/g, "");
}

const SECTION_TITLES: Record<ResumeSection, string> = {
  summary: "Professional Summary",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  certifications: "Certifications",
  projects: "Projects",
  languages: "Languages",
};

export function renderResumePdf(data: ResumeData): Promise<Buffer> {
  const theme = THEMES[data.template] ?? THEMES.classic;
  const margin = data.template === "compact" ? 40 : 50;
  const doc = new PDFDocument({ size: "A4", margin, info: { Title: `${safe(data.name)} — Resume`, Author: safe(data.name) } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const width = doc.page.width - margin * 2;

  // Header
  if (theme.headerBand) {
    doc.rect(0, 0, doc.page.width, 110).fill(theme.headerBand);
    doc.fillColor("#ffffff").font(theme.bold).fontSize(24).text(safe(data.name), margin, 32, { width });
    if (data.headline) doc.fillColor("#fcd34d").font(theme.font).fontSize(12).text(safe(data.headline), { width });
    doc.fillColor("#e5e7eb").fontSize(9).text(safe(data.contact.join("   |   ")), { width });
    doc.y = 130;
  } else {
    doc.fillColor(theme.accent).font(theme.bold).fontSize(data.template === "compact" ? 20 : 24).text(safe(data.name), { width, align: theme.align });
    if (data.headline) doc.fillColor("#374151").font(theme.font).fontSize(12).text(safe(data.headline), { width, align: theme.align });
    doc.moveDown(0.2).fillColor("#6b7280").fontSize(9).text(safe(data.contact.join("   |   ")), { width, align: theme.align });
    doc.moveDown(0.6);
    if (data.template === "modern") doc.rect(margin, doc.y, width, 3).fill(theme.accent);
    else doc.moveTo(margin, doc.y).lineTo(margin + width, doc.y).lineWidth(0.8).strokeColor("#9ca3af").stroke();
    doc.moveDown(0.8);
  }

  const heading = (title: string) => {
    if (doc.y > doc.page.height - margin - 60) doc.addPage();
    doc.moveDown(0.5);
    doc.fillColor(theme.accent).font(theme.bold).fontSize(theme.size + 2).text(data.template === "classic" ? title.toUpperCase() : title, margin, doc.y, { width, characterSpacing: data.template === "classic" ? 1 : 0 });
    const y = doc.y + 2;
    doc.moveTo(margin, y).lineTo(margin + width, y).lineWidth(0.5).strokeColor(data.template === "modern" ? theme.accent : "#d1d5db").stroke();
    doc.moveDown(0.5);
    doc.fillColor("#111827").font(theme.font).fontSize(theme.size);
  };

  const body = (text: string) => doc.fillColor("#1f2937").font(theme.font).fontSize(theme.size).text(safe(text), margin, doc.y, { width, lineGap: 1.5 });

  for (const section of data.sections) {
    switch (section) {
      case "summary":
        if (!data.summary) break;
        heading(SECTION_TITLES.summary);
        body(data.summary);
        break;
      case "skills":
        if (!data.skills.length) break;
        heading(SECTION_TITLES.skills);
        body(data.skills.join("  •  "));
        break;
      case "languages":
        if (!data.languages.length) break;
        heading(SECTION_TITLES.languages);
        body(data.languages.join(", "));
        break;
      case "experience":
        if (!data.experiences.length) break;
        heading(SECTION_TITLES.experience);
        for (const e of data.experiences) {
          if (doc.y > doc.page.height - margin - 50) doc.addPage();
          doc.fillColor("#111827").font(theme.bold).fontSize(theme.size + 0.5).text(safe(`${e.title} — ${e.company}`), margin, doc.y, { width, continued: false });
          doc.fillColor("#6b7280").font(theme.italic).fontSize(theme.size - 1).text(safe([e.period, e.location].filter(Boolean).join("  ·  ")), { width });
          if (e.description) {
            doc.moveDown(0.15);
            for (const line of e.description.split(/\n+/).filter(Boolean)) body(`•  ${line.replace(/^[-•*]\s*/, "")}`);
          }
          doc.moveDown(0.5);
        }
        break;
      case "education":
        if (!data.educations.length) break;
        heading(SECTION_TITLES.education);
        for (const e of data.educations) {
          doc.fillColor("#111827").font(theme.bold).fontSize(theme.size + 0.5).text(safe(e.degree), margin, doc.y, { width });
          doc.fillColor("#4b5563").font(theme.font).fontSize(theme.size - 0.5).text(safe([e.institution, e.period, e.grade].filter(Boolean).join("  ·  ")), { width });
          doc.moveDown(0.4);
        }
        break;
      case "certifications":
        if (!data.certifications.length) break;
        heading(SECTION_TITLES.certifications);
        for (const c of data.certifications) body(`•  ${[c.name, c.issuer, c.year].filter(Boolean).join(" — ")}`);
        break;
      case "projects":
        if (!data.projects.length) break;
        heading(SECTION_TITLES.projects);
        for (const p of data.projects) {
          doc.fillColor("#111827").font(theme.bold).fontSize(theme.size + 0.5).text(safe(p.name), margin, doc.y, { width });
          if (p.description) body(p.description);
          if (p.url) doc.fillColor(theme.accent).font(theme.font).fontSize(theme.size - 1).text(safe(p.url), { width, link: p.url });
          doc.moveDown(0.4);
        }
        break;
    }
  }

  doc.end();
  return done;
}
