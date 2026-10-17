import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./SignOutButton";

const signOut = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue({ error: null });
});

describe("SignOutButton", () => {
  it("asks for confirmation before signing out", async () => {
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Are you sure you want to sign out");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("cancel and Escape keep the user signed in", async () => {
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("confirming signs out, goes home and refreshes server data", async () => {
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(signOut).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/");
  });
});
