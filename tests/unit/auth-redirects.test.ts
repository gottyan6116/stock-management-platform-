// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PRODUCT } from "@/config/product";
import { GET as handleAuthCallback } from "@/app/auth/callback/route";
import { updateSession } from "@/lib/supabase/middleware";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: mocks.getUser,
      signOut: mocks.signOut,
    },
  }),
}));

function callbackRequest(redirectTo?: string) {
  const url = new URL("https://portfolio.example/auth/callback");
  url.searchParams.set("code", "valid-code");
  if (redirectTo !== undefined) url.searchParams.set("redirectTo", redirectTo);
  return new Request(url);
}

function middlewareRequest(path: string, redirectTo?: string) {
  const url = new URL(path, "https://portfolio.example");
  if (redirectTo !== undefined) url.searchParams.set("redirectTo", redirectTo);
  return new NextRequest(url);
}

describe("auth callback redirects", () => {
  beforeEach(() => {
    mocks.exchangeCodeForSession.mockReset();
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it.each([
    "javascript:alert(document.domain)",
    "https://attacker.example/steal",
    "//attacker.example/steal",
    "\\attacker.example/steal",
    "@attacker.example/steal",
    "/%2e%2e//attacker.example/steal",
    "/a/..//attacker.example/steal",
    "/.//attacker.example/steal",
    "/%2e//attacker.example/steal",
  ])("keeps hostile callback redirect %s on the callback origin", async (redirectTo) => {
    const response = await handleAuthCallback(callbackRequest(redirectTo));

    expect(response.headers.get("location")).toBe(
      `https://portfolio.example${PRODUCT.defaultAuthenticatedRoute}`
    );
  });

  it("keeps a valid callback path and query on the callback origin", async () => {
    const response = await handleAuthCallback(
      callbackRequest("/stocks/7203.T?tab=outlook#evidence")
    );

    expect(response.headers.get("location")).toBe(
      "https://portfolio.example/stocks/7203.T?tab=outlook#evidence"
    );
  });

  it("uses the product home when the callback has no requested path", async () => {
    const response = await handleAuthCallback(callbackRequest());

    expect(response.headers.get("location")).toBe(
      `https://portfolio.example${PRODUCT.defaultAuthenticatedRoute}`
    );
  });
});

describe("auth middleware redirects", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
    process.env.ALLOWED_EMAILS = "investor@example.com";
    mocks.getUser.mockReset();
    mocks.signOut.mockReset();
    mocks.getUser.mockResolvedValue({
      data: { user: { email: "investor@example.com" } },
    });
  });

  afterEach(() => {
    delete process.env.ALLOWED_EMAILS;
  });

  it("sends an authenticated login request to the product home by default", async () => {
    const response = await updateSession(middlewareRequest("/login"));

    expect(response.headers.get("location")).toBe(
      `https://portfolio.example${PRODUCT.defaultAuthenticatedRoute}`
    );
  });

  it("sanitizes an authenticated login redirect before navigating", async () => {
    const response = await updateSession(
      middlewareRequest("/login", "https://attacker.example/steal")
    );

    expect(response.headers.get("location")).toBe(
      `https://portfolio.example${PRODUCT.defaultAuthenticatedRoute}`
    );
  });

  it("keeps a valid authenticated login redirect on the current origin", async () => {
    const response = await updateSession(middlewareRequest("/login", "/portfolio?tab=growth"));

    expect(response.headers.get("location")).toBe("https://portfolio.example/portfolio?tab=growth");
  });
});
