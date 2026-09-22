import { describe, it, expect } from "vitest";
import {
  nestaAiSchema,
  contactApiSchema,
  exportSchema,
  createChatSessionSchema,
  updateChatSessionSchema,
  createChatMessageSchema,
} from "@/lib/validations/api";

describe("nestaAiSchema", () => {
  it("accepts minimal valid input", () => {
    const result = nestaAiSchema.parse({ question: "Hello?" });
    expect(result.question).toBe("Hello?");
    expect(result.history).toEqual([]);
  });

  it("rejects empty question", () => {
    expect(() => nestaAiSchema.parse({ question: "" })).toThrow();
  });

  it("rejects question over 2000 chars", () => {
    expect(() => nestaAiSchema.parse({ question: "a".repeat(2001) })).toThrow();
  });

  it("accepts history with valid role/content pairs", () => {
    const result = nestaAiSchema.parse({
      question: "Hi",
      history: [
        { role: "user", content: "prev question" },
        { role: "assistant", content: "prev answer" },
      ],
    });
    expect(result.history).toHaveLength(2);
  });

  it("rejects invalid role in history", () => {
    expect(() =>
      nestaAiSchema.parse({ question: "x", history: [{ role: "system", content: "bad" }] })
    ).toThrow();
  });

  it("accepts optional fileContent and fileName", () => {
    const result = nestaAiSchema.parse({
      question: "summarise",
      fileContent: "file text here",
      fileName: "resume.pdf",
    });
    expect(result.fileContent).toBe("file text here");
    expect(result.fileName).toBe("resume.pdf");
  });

  it("accepts a valid fileData data URI", () => {
    const result = nestaAiSchema.parse({
      question: "What's in this image?",
      fileData: "data:image/png;base64,abc",
      fileMediaType: "image/png",
    });
    expect(result.fileData).toBe("data:image/png;base64,abc");
  });

  it("rejects fileData that is not a data URI", () => {
    expect(() =>
      nestaAiSchema.parse({ question: "x", fileData: "https://evil.com/image.jpg" })
    ).toThrow();
  });

  it("rejects fileData over 7_000_000 chars", () => {
    expect(() =>
      nestaAiSchema.parse({ question: "x", fileData: "data:image/png;base64," + "a".repeat(7_000_000) })
    ).toThrow();
  });

  it("accepts all valid fileMediaType values", () => {
    for (const mime of ["image/jpeg", "image/png", "image/gif", "image/webp"] as const) {
      const result = nestaAiSchema.parse({
        question: "x",
        fileData: "data:image/png;base64,abc",
        fileMediaType: mime,
      });
      expect(result.fileMediaType).toBe(mime);
    }
  });

  it("rejects invalid fileMediaType like application/pdf", () => {
    expect(() =>
      nestaAiSchema.parse({
        question: "x",
        fileData: "data:image/png;base64,abc",
        fileMediaType: "application/pdf",
      })
    ).toThrow();
  });
});

describe("contactApiSchema", () => {
  const valid = {
    name: "John Doe",
    email: "john@example.com",
    subject: "Hello there",
    message: "This is a test message for the contact form.",
  };

  it("accepts valid contact form", () => {
    const result = contactApiSchema.parse(valid);
    expect(result.name).toBe("John Doe");
  });

  it("rejects name under 2 chars", () => {
    expect(() => contactApiSchema.parse({ ...valid, name: "A" })).toThrow();
  });

  it("rejects subject under 5 chars", () => {
    expect(() => contactApiSchema.parse({ ...valid, subject: "Hi" })).toThrow();
  });

  it("rejects message under 10 chars", () => {
    expect(() => contactApiSchema.parse({ ...valid, message: "Short" })).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => contactApiSchema.parse({ ...valid, email: "notanemail" })).toThrow();
  });
});

describe("exportSchema", () => {
  it("defaults to csv format", () => {
    const result = exportSchema.parse({});
    expect(result.format).toBe("csv");
  });

  it("accepts json format", () => {
    const result = exportSchema.parse({ format: "json" });
    expect(result.format).toBe("json");
  });

  it("rejects unknown format", () => {
    expect(() => exportSchema.parse({ format: "xml" })).toThrow();
  });

  it("parses comma-separated statuses string", () => {
    const result = exportSchema.parse({ statuses: "Applied,Interview" });
    expect(result.statuses).toEqual(["Applied", "Interview"]);
  });
});

describe("createChatSessionSchema", () => {
  it("defaults title to 'New Chat'", () => {
    const result = createChatSessionSchema.parse({});
    expect(result.title).toBe("New Chat");
  });

  it("accepts custom title", () => {
    const result = createChatSessionSchema.parse({ title: "My session" });
    expect(result.title).toBe("My session");
  });
});

describe("updateChatSessionSchema", () => {
  it("accepts title only", () => {
    const result = updateChatSessionSchema.parse({ title: "New name" });
    expect(result.title).toBe("New name");
  });

  it("accepts is_pinned only", () => {
    const result = updateChatSessionSchema.parse({ is_pinned: true });
    expect(result.is_pinned).toBe(true);
  });

  it("rejects empty object (neither field provided)", () => {
    expect(() => updateChatSessionSchema.parse({})).toThrow();
  });
});

describe("createChatMessageSchema", () => {
  it("accepts user message", () => {
    const result = createChatMessageSchema.parse({ role: "user", content: "Hello" });
    expect(result.role).toBe("user");
  });

  it("accepts assistant message with attachment metadata", () => {
    const result = createChatMessageSchema.parse({
      role: "assistant",
      content: "Sure!",
      metadata: { attachment: { name: "resume.pdf", fileType: "pdf" } },
    });
    expect(result.metadata?.attachment?.name).toBe("resume.pdf");
  });

  it("rejects empty content", () => {
    expect(() => createChatMessageSchema.parse({ role: "user", content: "" })).toThrow();
  });
});
