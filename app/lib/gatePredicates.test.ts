import { describe, it, expect } from "vitest";
import { checkCanPost, checkCanSubmit, checkCanFollowUp } from "./gatePredicates";

describe("checkCanPost", () => {
  it("returns false for whitespace-only text at the minimum (10 spaces)", () => {
    expect(checkCanPost(" ".repeat(10), false)).toBe(false);
  });

  it("returns false for 9 non-whitespace characters", () => {
    expect(checkCanPost("123456789", false)).toBe(false);
  });

  it("returns true for exactly 10 non-whitespace characters", () => {
    expect(checkCanPost("1234567890", false)).toBe(true);
  });

  it("returns false when submitting is true regardless of text length", () => {
    expect(checkCanPost("1234567890", true)).toBe(false);
  });
});

describe("checkCanSubmit", () => {
  const validUrl = "https://example.com/photo.jpg";
  const validReflection = "a".repeat(50);

  it("returns false for whitespace-only reflection at the minimum (50 spaces)", () => {
    expect(checkCanSubmit(validUrl, " ".repeat(50), false)).toBe(false);
  });

  it("returns false for reflection with 49 non-whitespace characters", () => {
    expect(checkCanSubmit(validUrl, "a".repeat(49), false)).toBe(false);
  });

  it("returns true for exactly 50 non-whitespace characters in reflection", () => {
    expect(checkCanSubmit(validUrl, validReflection, false)).toBe(true);
  });

  it("returns false for whitespace-only photoUrl", () => {
    expect(checkCanSubmit("   ", validReflection, false)).toBe(false);
  });

  it("returns false when submitting is true regardless of field values", () => {
    expect(checkCanSubmit(validUrl, validReflection, true)).toBe(false);
  });
});

describe("checkCanFollowUp", () => {
  const validUrl = "https://example.com/photo.jpg";
  const validReflection = "a".repeat(50);

  it("returns false when hasUser is false", () => {
    expect(checkCanFollowUp(false, validUrl, validReflection, false)).toBe(false);
  });

  it("returns false for whitespace-only reflection at the minimum (50 spaces)", () => {
    expect(checkCanFollowUp(true, validUrl, " ".repeat(50), false)).toBe(false);
  });

  it("returns false for reflection with 49 non-whitespace characters", () => {
    expect(checkCanFollowUp(true, validUrl, "a".repeat(49), false)).toBe(false);
  });

  it("returns true when all conditions are satisfied", () => {
    expect(checkCanFollowUp(true, validUrl, validReflection, false)).toBe(true);
  });

  it("returns false when submitting is true regardless of other values", () => {
    expect(checkCanFollowUp(true, validUrl, validReflection, true)).toBe(false);
  });
});
