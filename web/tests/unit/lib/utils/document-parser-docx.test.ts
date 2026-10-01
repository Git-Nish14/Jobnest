/**
 * Unit tests — DOCX extraction paths in document-parser utilities.
 *
 * Covers the mammoth-backed branches of:
 *   - extractTextFromBuffer (used by NESTAi /api/nesta-ai/parse-file)
 *   - extractDocumentText  (used by RAG indexing and document library flows)
 *
 * Mammoth is mocked via vi.mock so no real DOCX binary is needed.
 * document-parser.ts uses a top-level ESM import for mammoth, which lets
 * Vitest's module mock system intercept it correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("mammoth", () => ({
  extractRawText: vi.fn(),
  convertToHtml:  vi.fn(),
}));

import { extractTextFromBuffer, extractDocumentText } from "@/lib/utils/document-parser";
import * as mammothMod from "mammoth";

const mockExtractRaw = vi.mocked(mammothMod.extractRawText);

const DOCX_TEXT = "Jane Smith\nSoftware Engineer · 5 years TypeScript";
const DUMMY_BUF = Buffer.from("PK\x03\x04fake-docx-zip-bytes");

function makeStorageClient(content: Buffer | null = DUMMY_BUF) {
  return {
    storage: {
      from: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue(
          content
            ? { data: { arrayBuffer: () => Promise.resolve(content) }, error: null }
            : { data: null, error: new Error("storage error") },
        ),
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExtractRaw.mockResolvedValue({ value: DOCX_TEXT });
});

// ── extractTextFromBuffer (NESTAi chat-attachment path) ───────────────────────

describe("extractTextFromBuffer — .docx", () => {
  it("returns extracted text for .docx filename", async () => {
    const result = await extractTextFromBuffer(DUMMY_BUF, "resume.docx");
    expect(result.text).toBe(DOCX_TEXT);
    expect(result.error).toBeNull();
  });

  it("returns extracted text for .doc filename (same branch)", async () => {
    const result = await extractTextFromBuffer(DUMMY_BUF, "cv.doc");
    expect(result.text).toBe(DOCX_TEXT);
    expect(result.error).toBeNull();
  });

  it("passes the buffer to mammoth.extractRawText", async () => {
    await extractTextFromBuffer(DUMMY_BUF, "resume.docx");
    expect(mockExtractRaw).toHaveBeenCalledWith({ buffer: DUMMY_BUF });
  });

  it("returns null text + error when mammoth returns only whitespace", async () => {
    mockExtractRaw.mockResolvedValue({ value: "   \n\t  " });
    const result = await extractTextFromBuffer(DUMMY_BUF, "blank.docx");
    expect(result.text).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("truncates extracted text to 100 000 characters", async () => {
    mockExtractRaw.mockResolvedValue({ value: "x".repeat(200_000) });
    const result = await extractTextFromBuffer(DUMMY_BUF, "huge.docx");
    expect(result.text?.length).toBe(100_000);
  });

  it("returns null text + error for unsupported extension (.xlsx)", async () => {
    const result = await extractTextFromBuffer(DUMMY_BUF, "data.xlsx");
    expect(result.text).toBeNull();
    expect(result.error).toMatch(/not supported/i);
    expect(mockExtractRaw).not.toHaveBeenCalled();
  });
});

// ── extractDocumentText (document-library / RAG path) ─────────────────────────

describe("extractDocumentText — .docx storage path", () => {
  it("returns extracted text from a .docx file in storage", async () => {
    const client = makeStorageClient();
    const result = await extractDocumentText(client as never, "uid/library/Resume/cv.docx");
    expect(result.text).toBe(DOCX_TEXT);
    expect(result.error).toBeNull();
  });

  it("returns null text + error when storage download fails", async () => {
    const client = makeStorageClient(null);
    const result = await extractDocumentText(client as never, "uid/library/Resume/cv.docx");
    expect(result.text).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("returns null text + error when mammoth returns empty string", async () => {
    mockExtractRaw.mockResolvedValue({ value: "" });
    const client = makeStorageClient();
    const result = await extractDocumentText(client as never, "uid/library/Resume/empty.docx");
    expect(result.text).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("routes .doc files through the same mammoth branch", async () => {
    const client = makeStorageClient();
    const result = await extractDocumentText(client as never, "uid/library/CoverLetter/letter.doc");
    expect(result.text).toBe(DOCX_TEXT);
    expect(mockExtractRaw).toHaveBeenCalledTimes(1);
  });
});
