import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteSavedMatch } from "./DeleteSavedMatch";

const apiFetch = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/api/client", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue(undefined);
});

async function confirmDelete() {
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
}

describe("DeleteSavedMatch", () => {
  it("asks first, and cancelling deletes nothing", async () => {
    render(<DeleteSavedMatch id="m1" />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Delete this saved search?");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("deletes and refreshes the list", async () => {
    render(<DeleteSavedMatch id="m1" />);
    await confirmDelete();

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(apiFetch).toHaveBeenCalledWith("/match/saved/m1", { method: "DELETE" });
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves the detail page after deleting", async () => {
    render(<DeleteSavedMatch id="m1" redirectTo="/dashboard" />);
    await confirmDelete();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows an error and keeps the dialog open when the delete fails", async () => {
    apiFetch.mockRejectedValue(new Error("boom"));
    render(<DeleteSavedMatch id="m1" />);
    await confirmDelete();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't delete it");
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
