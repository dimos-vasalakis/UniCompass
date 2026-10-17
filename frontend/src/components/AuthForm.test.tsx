import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./AuthForm";

const signInWithOtp = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span>{props.alt}</span> }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp, signInWithOAuth: vi.fn() } }),
}));

beforeEach(() => {
  search = "";
  signInWithOtp.mockReset();
});

async function submitEmail(email: string) {
  await userEvent.type(screen.getByPlaceholderText("you@example.com"), email);
  await userEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
}

describe("AuthForm sign-in", () => {
  it("shows the same screen for unknown emails as for real ones", async () => {
    signInWithOtp.mockResolvedValue({ error: { code: "otp_disabled", message: "Signups not allowed for otp" } });
    render(<AuthForm mode="signin" configured />);
    await submitEmail("nobody@example.com");

    expect(screen.getByText("Check your email")).toBeInTheDocument();
    expect(screen.queryByText(/no account/i)).not.toBeInTheDocument();
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nobody@example.com", options: expect.objectContaining({ shouldCreateUser: false }) }),
    );
  });

  it("shows other errors", async () => {
    signInWithOtp.mockResolvedValue({ error: { code: "over_email_send_rate_limit", message: "Too many requests" } });
    render(<AuthForm mode="signin" configured />);
    await submitEmail("me@example.com");

    expect(screen.getByText("Too many requests")).toBeInTheDocument();
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
  });

  it("keeps next and the typed email when switching to sign-up", async () => {
    search = "next=/dashboard";
    render(<AuthForm mode="signin" configured />);
    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "me@example.com");

    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/signup?next=%2Fdashboard&email=me%40example.com",
    );
  });

  it("drops an off-site next", () => {
    search = "next=//evil.example";
    render(<AuthForm mode="signin" configured />);
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
  });
});
