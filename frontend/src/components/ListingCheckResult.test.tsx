import { screen } from "@testing-library/react";
import { render } from "@/test/utils";
import { describe, expect, it } from "vitest";
import type { ListingCheckResult as Result } from "@/types";
import { ListingCheckResult } from "./ListingCheckResult";

const NOT_A_LISTING: Result = {
  is_listing: false,
  details: {
    rent_eur: null,
    size_m2: null,
    floor: null,
    heating: null,
    furnished: null,
    bills_included: null,
    deposit_months: null,
    address_text: null,
    area_slug: null,
  },
  verdict: "not_a_listing",
  en: { summary: "This is a photo of a cat.", pros: [], cons: [], red_flags: [], questions_for_landlord: [] },
  el: { summary: "Αυτό είναι μια φωτογραφία γάτας.", pros: [], cons: [], red_flags: [], questions_for_landlord: [] },
  landlord_message_el: "",
  area: null,
};

describe("ListingCheckResult", () => {
  it("shows the answer in the current UI language", () => {
    render(<ListingCheckResult result={NOT_A_LISTING} />);
    expect(screen.getByText("This is a photo of a cat.")).toBeInTheDocument();
  });

  it("shows only the verdict and summary when it isn't a listing, in Greek", () => {
    render(<ListingCheckResult result={NOT_A_LISTING} />, { locale: "el" });
    expect(screen.getByText("Δεν είναι αγγελία")).toBeInTheDocument();
    expect(screen.getByText("Αυτό είναι μια φωτογραφία γάτας.")).toBeInTheDocument();
    expect(screen.queryByText("Τι λέει η αγγελία")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Αντιγραφή" })).not.toBeInTheDocument();
  });

  it("shows a deposit of 0 as 0 months, not as missing", () => {
    render(
      <ListingCheckResult
        result={{ ...NOT_A_LISTING, is_listing: true, verdict: "good", details: { ...NOT_A_LISTING.details, deposit_months: 0 } }}
      />,
    );
    expect(screen.getByText("0 months")).toBeInTheDocument();
  });
});
