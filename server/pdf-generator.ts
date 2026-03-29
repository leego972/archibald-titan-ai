/**
 * PDF Generator — server-side PDF creation using pdfkit.
 *
 * This module is the ONLY correct way to generate PDF files in Titan.
 * The LLM must call the `generate_pdf` tool, which calls `generatePdf()` here.
 *
 * Why this exists:
 * - PDF is a binary format. The LLM cannot produce valid PDF bytes as text output.
 * - Passing PDF content through create_file corrupts it (UTF-8 encoding of binary data).
 * - provide_project_zip wraps the file in a ZIP, which the user has to unzip — not ideal.
 * - This module generates a real binary PDF from structured Markdown/text content,
 *   uploads it to S3/R2, and returns a direct download URL.
 */

import PDFDocument from "pdfkit";
import { storagePut } from "./storage";
import { createLogger } from "./_core/logger.js";

const log = createLogger("PdfGenerator");

export interface PdfSection {
  /** Section heading (rendered as bold H2) */
  heading?: string;
  /** Body text — supports basic Markdown-style formatting:
   *  - Lines starting with "## " become sub-headings
   *  - Lines starting with "- " or "* " become bullet points
   *  - **bold** text is rendered in bold
   *  - Blank lines create paragraph breaks
   */
  body: string;
}

export interface GeneratePdfOptions {
  /** Document title shown at the top of the PDF */
  title: string;
  /** Optional subtitle shown below the title */
  subtitle?: string;
  /** Ordered list of sections to render */
  sections: PdfSection[];
  /** User ID — used for S3 key scoping */
  userId: number;
  /** Conversation ID — used for S3 key scoping */
  conversationId?: number;
  /** Desired filename (without path). Defaults to "report.pdf" */
  fileName?: string;
}

export interface GeneratePdfResult {
  success: boolean;
  /** Public download URL for the generated PDF */
  url?: string;
  /** S3/R2 key */
  s3Key?: string;
  /** File size in bytes */
  size?: number;
  error?: string;
}

// ─── Colour palette ──────────────────────────────────────────────────────────
const COLOUR = {
  title:     "#1a1a2e",
  heading:   "#16213e",
  subheading:"#0f3460",
  body:      "#2d2d2d",
  bullet:    "#444466",
  accent:    "#e94560",
  rule:      "#ccccdd",
  pageNum:   "#888899",
};

// ─── Font sizes ───────────────────────────────────────────────────────────────
const SIZE = {
  title:     26,
  subtitle:  13,
  heading:   16,
  subheading:13,
  body:      11,
  bullet:    11,
  footer:    9,
};

// ─── Margins ──────────────────────────────────────────────────────────────────
const MARGIN = { top: 60, bottom: 60, left: 60, right: 60 };

/**
 * Generate a PDF from structured content and upload it to S3/R2.
 * Returns a direct public download URL.
 */
export async function generatePdf(opts: GeneratePdfOptions): Promise<GeneratePdfResult> {
  const {
    title,
    subtitle,
    sections,
    userId,
    conversationId,
    fileName = "report.pdf",
  } = opts;

  return new Promise<GeneratePdfResult>((resolve) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.left, right: MARGIN.right },
        info: {
          Title: title,
          Author: "Archibald Titan",
          Creator: "Archibald Titan PDF Generator",
        },
        autoFirstPage: true,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", async () => {
        const pdfBuffer = Buffer.concat(chunks);
        try {
          const timestamp = Date.now();
          const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
          const s3Key = `projects/${userId}/${conversationId || "general"}/${timestamp}-${safeFileName}`;
          const result = await storagePut(s3Key, pdfBuffer, "application/pdf", safeFileName);
          log.info(`[PdfGenerator] PDF uploaded: ${s3Key} (${pdfBuffer.length} bytes)`);
          resolve({ success: true, url: result.url, s3Key, size: pdfBuffer.length });
        } catch (uploadErr) {
          log.error("[PdfGenerator] Upload failed:", { error: String(uploadErr) });
          resolve({ success: false, error: `PDF generated but upload failed: ${String(uploadErr)}` });
        }
      });
      doc.on("error", (err: Error) => {
        log.error("[PdfGenerator] PDFDocument error:", { error: String(err) });
        resolve({ success: false, error: String(err) });
      });

      const pageWidth = doc.page.width - MARGIN.left - MARGIN.right;

      // ── Cover / Title block ────────────────────────────────────────────────
      doc
        .rect(0, 0, doc.page.width, 140)
        .fill("#1a1a2e");

      doc
        .fillColor("#ffffff")
        .fontSize(SIZE.title)
        .font("Helvetica-Bold")
        .text(title, MARGIN.left, 50, { width: pageWidth, align: "left" });

      if (subtitle) {
        doc
          .fillColor("#aaaacc")
          .fontSize(SIZE.subtitle)
          .font("Helvetica")
          .text(subtitle, MARGIN.left, 50 + SIZE.title + 8, { width: pageWidth });
      }

      // Date line
      const dateStr = new Date().toLocaleDateString("en-AU", {
        day: "numeric", month: "long", year: "numeric",
      });
      doc
        .fillColor("#8888aa")
        .fontSize(SIZE.footer)
        .font("Helvetica")
        .text(`Generated by Archibald Titan · ${dateStr}`, MARGIN.left, 115, {
          width: pageWidth, align: "right",
        });

      doc.moveDown(4);

      // ── Sections ──────────────────────────────────────────────────────────
      for (const section of sections) {
        // Section heading
        if (section.heading) {
          // Ensure we have enough space for the heading + at least one line
          if (doc.y > doc.page.height - MARGIN.bottom - 60) {
            doc.addPage();
          }

          doc
            .fillColor(COLOUR.heading)
            .fontSize(SIZE.heading)
            .font("Helvetica-Bold")
            .text(section.heading, MARGIN.left, doc.y, { width: pageWidth });

          // Accent underline
          const lineY = doc.y + 2;
          doc
            .moveTo(MARGIN.left, lineY)
            .lineTo(MARGIN.left + Math.min(pageWidth, section.heading.length * 9), lineY)
            .strokeColor(COLOUR.accent)
            .lineWidth(1.5)
            .stroke();

          doc.moveDown(0.6);
        }

        // Body — parse line by line
        const lines = section.body.split("\n");
        for (const rawLine of lines) {
          const line = rawLine.trimEnd();

          if (line === "") {
            doc.moveDown(0.4);
            continue;
          }

          // Sub-heading: ## text
          if (/^#{1,3}\s/.test(line)) {
            const text = line.replace(/^#{1,3}\s+/, "");
            if (doc.y > doc.page.height - MARGIN.bottom - 40) doc.addPage();
            doc
              .fillColor(COLOUR.subheading)
              .fontSize(SIZE.subheading)
              .font("Helvetica-Bold")
              .text(text, MARGIN.left, doc.y, { width: pageWidth });
            doc.moveDown(0.3);
            continue;
          }

          // Bullet point: - text or * text
          if (/^[-*•]\s/.test(line)) {
            const text = line.replace(/^[-*•]\s+/, "");
            if (doc.y > doc.page.height - MARGIN.bottom - 20) doc.addPage();
            // Bullet dot
            doc
              .fillColor(COLOUR.accent)
              .fontSize(SIZE.bullet)
              .font("Helvetica-Bold")
              .text("•", MARGIN.left, doc.y, { width: 12, continued: false });
            // Bullet text (indented)
            doc
              .fillColor(COLOUR.bullet)
              .fontSize(SIZE.bullet)
              .font("Helvetica")
              .text(stripInlineBold(text), MARGIN.left + 14, doc.y - SIZE.bullet - 2, {
                width: pageWidth - 14,
              });
            doc.moveDown(0.2);
            continue;
          }

          // Numbered list: 1. text
          if (/^\d+\.\s/.test(line)) {
            const match = line.match(/^(\d+)\.\s+(.*)/);
            if (match) {
              const num = match[1];
              const text = match[2];
              if (doc.y > doc.page.height - MARGIN.bottom - 20) doc.addPage();
              doc
                .fillColor(COLOUR.accent)
                .fontSize(SIZE.bullet)
                .font("Helvetica-Bold")
                .text(`${num}.`, MARGIN.left, doc.y, { width: 18, continued: false });
              doc
                .fillColor(COLOUR.body)
                .fontSize(SIZE.bullet)
                .font("Helvetica")
                .text(stripInlineBold(text), MARGIN.left + 20, doc.y - SIZE.bullet - 2, {
                  width: pageWidth - 20,
                });
              doc.moveDown(0.2);
              continue;
            }
          }

          // Horizontal rule: --- or ===
          if (/^[-=]{3,}$/.test(line)) {
            doc.moveDown(0.3);
            doc
              .moveTo(MARGIN.left, doc.y)
              .lineTo(MARGIN.left + pageWidth, doc.y)
              .strokeColor(COLOUR.rule)
              .lineWidth(0.5)
              .stroke();
            doc.moveDown(0.3);
            continue;
          }

          // Normal body text
          if (doc.y > doc.page.height - MARGIN.bottom - 20) doc.addPage();
          doc
            .fillColor(COLOUR.body)
            .fontSize(SIZE.body)
            .font("Helvetica")
            .text(stripInlineBold(line), MARGIN.left, doc.y, { width: pageWidth });
          doc.moveDown(0.15);
        }

        doc.moveDown(0.8);
      }

      // ── Page numbers ──────────────────────────────────────────────────────
      const totalPages = (doc.bufferedPageRange().count);
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc
          .fillColor(COLOUR.pageNum)
          .fontSize(SIZE.footer)
          .font("Helvetica")
          .text(
            `Page ${i + 1} of ${totalPages}`,
            MARGIN.left,
            doc.page.height - MARGIN.bottom + 10,
            { width: pageWidth, align: "center" }
          );
      }

      doc.end();
    } catch (err) {
      log.error("[PdfGenerator] Unexpected error:", { error: String(err) });
      resolve({ success: false, error: String(err) });
    }
  });
}

/** Strip **bold** markers for plain-text rendering in pdfkit */
function stripInlineBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
}
