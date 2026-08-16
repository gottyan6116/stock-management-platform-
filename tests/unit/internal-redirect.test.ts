import { describe, expect, it } from "vitest";
import { PRODUCT } from "@/config/product";
import { sanitizeInternalPath } from "@/lib/navigation/internal-path";

describe("sanitizeInternalPath", () => {
  it.each([
    "javascript:alert(document.domain)",
    "https://attacker.example/steal",
    "//attacker.example/steal",
    "\\attacker.example/steal",
    "\\\\attacker.example/steal",
    "/\\attacker.example/steal",
    "/%5C%5Cattacker.example/steal",
    "@attacker.example/steal",
    "/%2e%2e//attacker.example/steal",
    "/a/..//attacker.example/steal",
    "/.//attacker.example/steal",
    "/%2e//attacker.example/steal",
  ])("falls back for hostile redirect input %s", (candidate) => {
    expect(sanitizeInternalPath(candidate)).toBe(PRODUCT.defaultAuthenticatedRoute);
  });

  it.each([
    ["/", "/"],
    ["/home", "/home"],
    ["/stocks/7203.T?tab=outlook#evidence", "/stocks/7203.T?tab=outlook#evidence"],
  ])("keeps valid internal paths on the current origin", (candidate, expected) => {
    expect(sanitizeInternalPath(candidate)).toBe(expected);
  });

  it("uses the product default when no redirect was requested", () => {
    expect(sanitizeInternalPath(null)).toBe(PRODUCT.defaultAuthenticatedRoute);
    expect(sanitizeInternalPath(undefined)).toBe(PRODUCT.defaultAuthenticatedRoute);
  });
});
