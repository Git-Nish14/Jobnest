import { describe, it, expect } from "vitest";
import { validateMagicBytes, validateFileClient, mimeToLabel, isPreviewable, isTextExtractable } from "@/lib/utils/storage";

describe("validateMagicBytes", () => {
  it("accepts a valid PDF buffer", () => {
    const buf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1
    expect(validateMagicBytes(buf, "application/pdf")).toBe(true);
  });

  it("rejects a fake PDF buffer (wrong magic bytes)", () => {
    const buf = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    expect(validateMagicBytes(buf, "application/pdf")).toBe(false);
  });

  it("accepts a valid PNG buffer", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(validateMagicBytes(buf, "image/png")).toBe(true);
  });

  it("rejects a fake PNG buffer", () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(validateMagicBytes(buf, "image/png")).toBe(false);
  });

  it("accepts a valid JPEG buffer", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateMagicBytes(buf, "image/jpeg")).toBe(true);
  });

  it("accepts a valid DOCX (PK zip header) buffer", () => {
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    expect(validateMagicBytes(buf, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
  });

  it("returns true for text/plain (no magic bytes enforced)", () => {
    const buf = Buffer.from("Hello world");
    expect(validateMagicBytes(buf, "text/plain")).toBe(true);
  });

  it("returns true for unknown MIME type (no check)", () => {
    const buf = Buffer.from([0x00, 0x00]);
    expect(validateMagicBytes(buf, "application/unknown")).toBe(true);
  });
});

describe("validateFileClient", () => {
  function makeFile(name: string, type: string, size: number): File {
    const blob = new Blob(["x".repeat(size)], { type });
    return new File([blob], name, { type });
  }

  it("throws for files over 10 MB", () => {
    const file = makeFile("big.pdf", "application/pdf", 11 * 1024 * 1024);
    expect(() => validateFileClient(file)).toThrow("10 MB");
  });

  it("throws for unsupported MIME type", () => {
    const file = makeFile("evil.exe", "application/x-msdownload", 100);
    expect(() => validateFileClient(file)).toThrow("not supported");
  });

  it("does not throw for a valid PDF file", () => {
    const file = makeFile("resume.pdf", "application/pdf", 1024);
    expect(() => validateFileClient(file)).not.toThrow();
  });

  it("does not throw for a JPEG image", () => {
    const file = makeFile("photo.jpg", "image/jpeg", 2048);
    expect(() => validateFileClient(file)).not.toThrow();
  });
});

describe("mimeToLabel", () => {
  it("returns PDF for application/pdf", () => {
    expect(mimeToLabel("application/pdf")).toBe("PDF");
  });

  it("returns DOCX for the long OOXML MIME", () => {
    expect(mimeToLabel("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("DOCX");
  });

  it("returns File for unknown MIME", () => {
    expect(mimeToLabel("application/unknown")).toBe("File");
  });
});

describe("isPreviewable", () => {
  it("returns true for PDF", () => expect(isPreviewable("application/pdf")).toBe(true));
  it("returns true for images", () => {
    expect(isPreviewable("image/png")).toBe(true);
    expect(isPreviewable("image/jpeg")).toBe(true);
  });
  it("returns false for DOCX", () => {
    expect(isPreviewable("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);
  });
});

describe("isTextExtractable", () => {
  it("returns true for PDF", () => expect(isTextExtractable("application/pdf")).toBe(true));
  it("returns true for DOCX", () => {
    expect(isTextExtractable("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
  });
  it("returns true for text/plain and text/markdown", () => {
    expect(isTextExtractable("text/plain")).toBe(true);
    expect(isTextExtractable("text/markdown")).toBe(true);
  });
  it("returns false for PNG", () => expect(isTextExtractable("image/png")).toBe(false));
});
