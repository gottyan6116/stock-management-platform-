import { PRODUCT } from "@/config/product";

const INTERNAL_ORIGIN = "https://internal.invalid";
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const ENCODED_BACKSLASH = /%5c/i;

/**
 * Accepts only a single-slash path that stays on the current origin.
 * Authentication query parameters are attacker-controlled, so invalid input
 * always returns the product's authenticated landing page.
 */
export function sanitizeInternalPath(candidate: string | null | undefined): string {
  if (
    !candidate ||
    candidate !== candidate.trim() ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    ENCODED_BACKSLASH.test(candidate) ||
    CONTROL_CHARACTER.test(candidate)
  ) {
    return PRODUCT.defaultAuthenticatedRoute;
  }

  try {
    const base = new URL(INTERNAL_ORIGIN);
    const parsed = new URL(candidate, base);
    if (
      parsed.origin !== base.origin ||
      parsed.username ||
      parsed.password ||
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.startsWith("//") ||
      parsed.pathname.includes("\\")
    ) {
      return PRODUCT.defaultAuthenticatedRoute;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return PRODUCT.defaultAuthenticatedRoute;
  }
}
