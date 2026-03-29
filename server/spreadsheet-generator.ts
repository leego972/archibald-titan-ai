/**
 * Spreadsheet Generator — server-side XLSX and CSV generation.
 *
 * Like pdf-generator.ts, this module exists because the LLM cannot produce
 * valid binary XLSX files as text output. create_file would corrupt binary data.
 *
 * The LLM must call the 'generate_spreadsheet' tool, which calls generateSpreadsheet() here.
 * The result is a real .xlsx or .csv file uploaded to S3/R2 with a direct download URL.
 */

import ExcelJS from "exceljs";
import { storagePut } from "./storage";
import { createLogger } from "./_core/logger.js";

const log = createLogger("SpreadsheetGenerator");

export interface SpreadsheetColumn {
  /** Column header label */
  header: string;
  /** Data key in each row object */
  key: string;
  /** Column width in characters (default: auto) */
  width?: number;
}

export interface SpreadsheetSheet {
  /** Sheet name (tab label) */
  name: string;
  /** Column definitions */
  columns: SpreadsheetColumn[];
  /** Array of row objects — keys must match column keys */
  rows: Record<string, string | number | boolean | null | undefined>[];
}

export interface GenerateSpreadsheetOptions {
  /** Document title — used as the first sheet name if only one sheet */
  title: string;
  /** One or more sheets */
  sheets: SpreadsheetSheet[];
  /** Output format: 'xlsx' (default) or 'csv' (only first sheet) */
  format?: "xlsx" | "csv";
  /** Desired filename (without path). Defaults to slugified title + extension */
  fileName?: string;
  /** User ID for S3 key scoping */
  userId: number;
  /** Conversation ID for S3 key scoping */
  conversationId?: number;
}

export interface GenerateSpreadsheetResult {
  success: boolean;
  url?: string;
  s3Key?: string;
  size?: number;
  error?: string;
}

// ─── Colour palette for header rows ──────────────────────────────────────────
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1A1A2E" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};
const ALT_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF5F5FA" },
};

/**
 * Generate a real binary XLSX or CSV file from structured data and upload to S3/R2.
 * Returns a direct public download URL.
 */
export async function generateSpreadsheet(
  opts: GenerateSpreadsheetOptions
): Promise<GenerateSpreadsheetResult> {
  const {
    title,
    sheets,
    format = "xlsx",
    userId,
    conversationId,
  } = opts;

  const ext = format === "csv" ? "csv" : "xlsx";
  const fileName =
    opts.fileName ||
    `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${ext}`;
  const safeFileName = fileName.endsWith(`.${ext}`) ? fileName : `${fileName}.${ext}`;

  try {
    let fileBuffer: Buffer;
    let contentType: string;

    if (format === "csv") {
      // ── CSV: simple, no binary issues ──────────────────────────────────────
      const sheet = sheets[0];
      const lines: string[] = [];
      // Header row
      lines.push(sheet.columns.map(c => csvEscape(c.header)).join(","));
      // Data rows
      for (const row of sheet.rows) {
        lines.push(sheet.columns.map(c => csvEscape(String(row[c.key] ?? ""))).join(","));
      }
      fileBuffer = Buffer.from(lines.join("\r\n"), "utf-8");
      contentType = "text/csv";
    } else {
      // ── XLSX: styled workbook ───────────────────────────────────────────────
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Archibald Titan";
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.properties.date1904 = false;

      for (const sheetDef of sheets) {
        const ws = workbook.addWorksheet(sheetDef.name || "Sheet1", {
          views: [{ state: "frozen", ySplit: 1 }],
        });

        // Define columns
        ws.columns = sheetDef.columns.map(col => ({
          header: col.header,
          key: col.key,
          width: col.width || Math.max(col.header.length + 4, 14),
        }));

        // Style header row
        const headerRow = ws.getRow(1);
        headerRow.eachCell(cell => {
          cell.fill = HEADER_FILL;
          cell.font = HEADER_FONT;
          cell.alignment = { vertical: "middle", horizontal: "left" };
          cell.border = {
            bottom: { style: "thin", color: { argb: "FFE94560" } },
          };
        });
        headerRow.height = 22;
        headerRow.commit();

        // Add data rows with alternating row colours
        sheetDef.rows.forEach((rowData, idx) => {
          const row = ws.addRow(rowData);
          if (idx % 2 === 1) {
            row.eachCell(cell => {
              cell.fill = ALT_ROW_FILL;
            });
          }
          row.eachCell(cell => {
            cell.alignment = { vertical: "middle", wrapText: false };
          });
          row.commit();
        });

        // Auto-filter on header row
        ws.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: sheetDef.columns.length },
        };
      }

      fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    // Upload to S3/R2
    const timestamp = Date.now();
    const s3Key = `projects/${userId}/${conversationId || "general"}/${timestamp}-${safeFileName}`;
    const result = await storagePut(s3Key, fileBuffer, contentType, safeFileName);

    log.info(`[SpreadsheetGenerator] Uploaded: ${s3Key} (${fileBuffer.length} bytes, ${format})`);

    return { success: true, url: result.url, s3Key, size: fileBuffer.length };
  } catch (err) {
    log.error("[SpreadsheetGenerator] Error:", { error: String(err) });
    return { success: false, error: String(err) };
  }
}

/** Escape a value for CSV output */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
