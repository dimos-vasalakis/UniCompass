import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./AuthForm";

const signInWithOtp = vi.fn();
const getSession = vi.fn();
const verifyOtp = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span>{props.alt}</span> }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp, getSession, verifyOtp, signInWithOAuth: vi.fn() } }),
}));

beforeEach(() => {
  search = "";
  signInWithOtp.mockReset();
  getSession.mockReset().mockResolvedValue({ data: { session: null } });
  verifyOtp.mockReset();
  replace.mockReset();
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

  it("leaves the check-your-email screen once the link signs in from another tab", async () => {
    search = "next=/match";
    signInWithOtp.mockResolvedValue({ error: null });
    render(<AuthForm mode="signin" configured />);
    await submitEmail("me@example.com");
    expect(screen.getByText("Check your email")).toBeInTheDocument();

    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(getSession).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();

    getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/match"));
  });

  it("signs in this tab with the code from the email", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValueOnce({ error: { message: "Token has expired or is invalid" } });
    render(<AuthForm mode="signin" configured />);
    await submitEmail("me@example.com");

    await userEvent.type(screen.getByLabelText("Code from the email"), "12a3456");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(verifyOtp).toHaveBeenCalledWith({ email: "me@example.com", token: "123456", type: "email" });
    expect(screen.getByText(/code is wrong or has expired/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    verifyOtp.mockResolvedValueOnce({ error: null });
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(replace).toHaveBeenCalledWith("/dashboard");
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

describe("AuthForm in Greek", () => {
  it("shows Greek copy and keeps the same behaviour", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(<AuthForm mode="signin" configured />, { locale: "el" });
    expect(screen.getByRole("heading", { name: "Καλώς ήρθες ξανά" })).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "a@b.gr");
    await userEvent.click(screen.getByRole("button", { name: "Στείλε μου σύνδεσμο σύνδεσης" }));
    expect(screen.getByText("Έλεγξε το email σου")).toBeInTheDocument();
    expect(screen.getByText("a@b.gr")).toBeInTheDocument();
  });
});
