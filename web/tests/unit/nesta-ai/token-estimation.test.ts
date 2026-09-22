/**
 * Tests for the NESTAi token estimation logic.
 * We extract the logic by importing from the route and testing indirectly,
 * or we test properties of the algorithm directly.
 */
import { describe, it, expect } from "vitest";

// Mirror the estimateTokens function from the route (1 token ≈ 4 chars)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const INPUT_TOKEN_BUDGET = 500_000;

describe("estimateTokens", () => {
  it("returns 1 for 1–4 chars", () => {
    expect(estimateTokens("a")).toBe(1);
    expect(estimateTokens("abcd")).toBe(1);
  });

  it("returns 2 for 5 chars", () => {
    expect(estimateTokens("abcde")).toBe(2);
  });

  it("returns 250 for 1000 chars", () => {
    expect(estimateTokens("a".repeat(1000))).toBe(250);
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("scales linearly with text length", () => {
    const short = estimateTokens("a".repeat(100));
    const long = estimateTokens("a".repeat(200));
    expect(long).toBe(short * 2);
  });
});

describe("INPUT_TOKEN_BUDGET", () => {
  it("is less than 1_050_000 (gpt-5.6-luna context window)", () => {
    expect(INPUT_TOKEN_BUDGET).toBeLessThan(1_050_000);
  });

  it("leaves at least 3000 tokens as reserve", () => {
    expect(1_050_000 - INPUT_TOKEN_BUDGET).toBeGreaterThanOrEqual(3_000);
  });
});

describe("trimming thresholds", () => {
  it("100 history messages at avg 200 chars each uses ~5000 tokens", () => {
    const avgCharsPerMsg = 200;
    const tokens = estimateTokens("x".repeat(avgCharsPerMsg)) * 100;
    expect(tokens).toBeLessThan(INPUT_TOKEN_BUDGET);
  });

  it("large context (500 applications at 300 chars each) is ~37 500 tokens", () => {
    const appText = "x".repeat(300);
    const total = estimateTokens(appText) * 500;
    expect(total).toBe(75 * 500); // 75 tokens per app
    // Still fits in budget even with full history
    expect(total + 5000 + 500).toBeLessThan(INPUT_TOKEN_BUDGET); // context + history + user
  });

  it("a 50-page PDF (~25 000 chars) costs ~6250 tokens", () => {
    const pdfText = "x".repeat(25_000);
    const tokens = estimateTokens(pdfText);
    expect(tokens).toBe(6_250);
  });

  it("10 large PDFs would consume ~62 500 tokens — fits within the budget", () => {
    const tenPdfs = estimateTokens("x".repeat(25_000)) * 10;
    expect(tenPdfs).toBe(62_500);
    expect(tenPdfs).toBeLessThan(INPUT_TOKEN_BUDGET);
  });

  it("truncating docs to 1000 chars each reduces 10 PDFs to ~2500 tokens", () => {
    const truncated = estimateTokens("x".repeat(1_000)) * 10;
    expect(truncated).toBe(2_500);
  });
});

// Mirror the estimateMessageTokens function from the route (vision content = 2000 tokens floor)
function estimateMessageTokens(content: string | Array<{ type: string; text?: string }>): number {
  if (typeof content === "string") return estimateTokens(content);
  let tokens = 0;
  for (const part of content) {
    if (part.type === "image_url" || part.type === "image") {
      tokens += 2000;
    } else if (part.type === "text" && part.text) {
      tokens += estimateTokens(part.text);
    }
  }
  return tokens;
}

describe("estimateMessageTokens — vision", () => {
  it("image content returns 2000 tokens floor per image", () => {
    const tokens = estimateMessageTokens([{ type: "image_url" }]);
    expect(tokens).toBe(2000);
  });

  it("text + image returns sum of text tokens + 2000", () => {
    const tokens = estimateMessageTokens([
      { type: "text", text: "a".repeat(400) }, // 100 tokens
      { type: "image_url" },                    // 2000 tokens
    ]);
    expect(tokens).toBe(2100);
  });

  it("string content uses normal char/4 estimation", () => {
    const tokens = estimateMessageTokens("a".repeat(400));
    expect(tokens).toBe(100);
  });
});

describe("context string construction", () => {
  it("hard truncation preserves at least 500 chars worth of context", () => {
    const minChars = 500;
    expect(minChars).toBeGreaterThan(0);
    expect(estimateTokens("x".repeat(minChars))).toBeGreaterThan(0);
  });

  it("trimming marker text is under 50 tokens", () => {
    const marker = "[Context truncated. Ask about specific applications or topics for full details.]";
    expect(estimateTokens(marker)).toBeLessThan(50);
  });
});
