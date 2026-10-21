import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { ListingCheck } from "@/types";
import { ListingCheckForm } from "./ListingCheckForm";

const apiFetch = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));
vi.mock("@/lib/listingImage", () => ({
  prepareImage: async (f: File) => ({ media_type: "image/jpeg", data_base64: btoa(f.name) }),
}));

const CHECK: ListingCheck = {
  id: "c1",
  created_at: "2026-10-21T10:00:00Z",
  lang: "en",
  department_id: null,
  input_text: "flat",
  image_count: 0,
  result: {
    is_listing: true,
    details: {
      rent_eur: 450,
      size_m2: 30,
      floor: "2",
      heating: null,
      furnished: true,
      bills_included: null,
      deposit_months: 2,
      address_text: null,
      area_slug: "zografou",
    },
    verdict: "overpriced",
    summary: "A bit expensive for Zografou.",
    pros: [],
    cons: [],
    red_flags: ["Asks for a deposit before a viewing"],
    questions_for_landlord: [],
    landlord_message_el: "Καλησπέρα σας",
    area: {
      slug: "zografou",
      name: "Zografou",
      name_el: "Ζωγράφου",
      typical_studio_rent: 400,
      price_vs_area_pct: 13,
      commute_minutes: 15,
      commute_estimated: false,
      canteen: null,
      metro: null,
    },
  },
};

function renderForm(remaining = 3) {
  return render(
    <ListingCheckForm
      universities={[]}
      limits={{ checks_per_account: 3, max_images: 3, max_text_chars: 6000 }}
      remaining={remaining}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({ ...CHECK, remaining: 2 });
});

describe("ListingCheckForm", () => {
  it("shows the quota and hides the form when no checks are left", () => {
    renderForm(0);
    expect(screen.getByText("You've used all 3 of your listing checks.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check this listing" })).not.toBeInTheDocument();
  });

  it("asks for text or a screenshot before calling the API", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Check this listing" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Paste the listing text or add a screenshot.");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("submits, shows the answer and counts the check", async () => {
    renderForm();
    expect(screen.getByText("3 checks left")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Listing text"), "Studio in Zografou 450€");
    await userEvent.click(screen.getByRole("button", { name: "Check this listing" }));

    expect(await screen.findByText("Overpriced")).toBeInTheDocument();
    expect(screen.getByText("+13%")).toBeInTheDocument();
    expect(screen.getByText("Asks for a deposit before a viewing")).toBeInTheDocument();
    expect(screen.getByText("2 checks left")).toBeInTheDocument();
    const [path, init] = apiFetch.mock.calls[0];
    expect(path).toBe("/assistant/listing-checks?lang=en");
    expect(JSON.parse(init.body)).toEqual({ department_id: null, text: "Studio in Zografou 450€", images: [] });
    expect(init.headers["Idempotency-Key"]).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
  });

  it("allows at most 3 screenshots", async () => {
    renderForm();
    const files = ["a.png", "b.png", "c.png", "d.png"].map((n) => new File(["x"], n, { type: "image/png" }));
    await userEvent.upload(screen.getByLabelText("Add screenshots"), files);
    expect(await screen.findAllByRole("button", { name: /Remove screenshot/ })).toHaveLength(3);
    expect(screen.getByRole("alert")).toHaveTextContent("You can add up to 3 screenshots.");
    expect(screen.queryByLabelText("Add screenshots")).not.toBeInTheDocument();
  });

  it("sends visitors whose session expired to sign-up", async () => {
    apiFetch.mockRejectedValue(new ApiError(401, "unauthorized"));
    renderForm();
    await userEvent.type(screen.getByLabelText("Listing text"), "flat");
    await userEvent.click(screen.getByRole("button", { name: "Check this listing" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/signup?next=/assistant"));
  });

  it("shows no checks left when the server says so", async () => {
    apiFetch.mockRejectedValue(new ApiError(402, "No checks left"));
    renderForm(1);
    await userEvent.type(screen.getByLabelText("Listing text"), "flat");
    await userEvent.click(screen.getByRole("button", { name: "Check this listing" }));
    expect(await screen.findByText("You've used all 3 of your listing checks.")).toBeInTheDocument();
  });

  it("waits for an earlier request with the same key instead of failing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      apiFetch.mockRejectedValueOnce(new ApiError(409, "Still checking")).mockResolvedValueOnce({ ...CHECK, remaining: 2 });
      renderForm();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.type(screen.getByLabelText("Listing text"), "flat");
      await user.click(screen.getByRole("button", { name: "Check this listing" }));
      await vi.advanceTimersByTimeAsync(3000);
      expect(await screen.findByText("Overpriced")).toBeInTheDocument();
      const keys = apiFetch.mock.calls.map(([, init]) => init.headers["Idempotency-Key"]);
      expect(keys).toHaveLength(2);
      expect(keys[0]).toBe(keys[1]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("explains a rejected screenshot instead of saying try again", async () => {
    apiFetch.mockRejectedValue(new ApiError(422, "Image too large"));
    renderForm();
    await userEvent.upload(screen.getByLabelText("Add screenshots"), new File(["x"], "a.png", { type: "image/png" }));
    await screen.findByRole("button", { name: "Remove screenshot 1" });
    await userEvent.click(screen.getByRole("button", { name: "Check this listing" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't use one of the screenshots");
  });

  it("picks the university first, then one of its departments", async () => {
    render(
      <ListingCheckForm
        universities={[
          {
            slug: "ntua",
            name: "National Technical University of Athens",
            short_name: "NTUA (ΕΜΠ)",
            campuses: [{ slug: "ntua-zografou", name: "Zografou", lat: 0, lng: 0 }],
            departments: [{ id: "d1", name: "Civil Engineering", campus_slug: "ntua-zografou" }],
          },
        ]}
        limits={{ checks_per_account: 3, max_images: 3, max_text_chars: 6000 }}
        remaining={1}
      />,
    );
    expect(screen.getByText("1 check left")).toBeInTheDocument();
    expect(screen.queryByLabelText("Department")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "NTUA (ΕΜΠ)" }));
    await userEvent.selectOptions(screen.getByLabelText("Department"), "d1");
    await userEvent.type(screen.getByLabelText("Listing text"), "flat");
    await userEvent.click(screen.getByRole("button", { name: "Check this listing" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(JSON.parse(apiFetch.mock.calls[0][1].body).department_id).toBe("d1");
  });
});

