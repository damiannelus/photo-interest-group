import { describe, it, expect } from "vitest";
import { parseAllowedEmails } from "./allowedEmails";

describe("parseAllowedEmails", () => {
  it("lowercases uppercase email addresses", () => {
    expect(parseAllowedEmails("User@Example.COM")).toContain("user@example.com");
  });

  it("trims surrounding whitespace from each entry", () => {
    expect(parseAllowedEmails("  user@example.com  ")).toContain(
      "user@example.com"
    );
  });

  it("splits a comma-separated list into the correct number of entries", () => {
    const result = parseAllowedEmails("a@b.com, c@d.com");
    expect(result).toEqual(["a@b.com", "c@d.com"]);
  });

  it("filters out whitespace-only entries", () => {
    expect(parseAllowedEmails("  ,  ")).toEqual([]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseAllowedEmails("")).toEqual([]);
  });
});
