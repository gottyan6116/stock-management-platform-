import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/LoginForm";
import { PRODUCT } from "@/config/product";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  searchParamsGet: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => ({ get: mocks.searchParamsGet }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: mocks.signInWithPassword },
  }),
}));

describe("LoginForm accessibility", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    mocks.searchParamsGet.mockReset();
    mocks.searchParamsGet.mockReturnValue(null);
    mocks.signInWithPassword.mockReset();
    mocks.signInWithPassword.mockResolvedValue({ error: null });
  });

  it("keeps every form control at least 44px tall with a visible keyboard focus ring", () => {
    render(<LoginForm />);

    const controls = [
      screen.getByLabelText("メールアドレス"),
      screen.getByLabelText("パスワード"),
      screen.getByRole("button", { name: "ログイン" }),
    ];

    for (const control of controls) {
      expect(control).toHaveClass("min-h-11");
      expect(control).toHaveClass("focus-visible:outline-none");
      expect(control).toHaveClass("focus-visible:ring-2");
      expect(control).toHaveClass("focus-visible:ring-focus");
      expect(control).toHaveClass("focus-visible:ring-offset-2");
    }
  });

  it("announces a query-code login error as an assertive alert", () => {
    mocks.searchParamsGet.mockImplementation((name: string) =>
      name === "error" ? "not_allowed" : null
    );

    render(<LoginForm />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("このメールアドレスは利用が許可されていません。");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("announces a sign-in error as an assertive alert", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: new Error("invalid credentials") });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "investor@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "not-a-real-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("メールアドレスまたはパスワードが正しくありません。");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it.each([
    "javascript:alert(document.domain)",
    "https://attacker.example/steal",
    "//attacker.example/steal",
    "\\attacker.example/steal",
    "@attacker.example/steal",
  ])("falls back to the product home after login for hostile redirect %s", async (redirectTo) => {
    mocks.searchParamsGet.mockImplementation((name: string) =>
      name === "redirectTo" ? redirectTo : null
    );

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "investor@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "not-a-real-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(PRODUCT.defaultAuthenticatedRoute));
  });

  it("keeps a valid internal path after login", async () => {
    mocks.searchParamsGet.mockImplementation((name: string) =>
      name === "redirectTo" ? "/stocks/7203.T?tab=outlook" : null
    );

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "investor@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "not-a-real-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/stocks/7203.T?tab=outlook"));
  });
});
