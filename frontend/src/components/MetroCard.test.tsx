import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/utils";
import { describe, expect, it } from "vitest";
import type { Metro } from "@/types";
import { MetroCard } from "./MetroCard";

const metro: Metro = {
  station: { slug: "syntagma", name: "Syntagma", lat: 37.9755, lng: 23.7348 },
  lines: [
    { slug: "m2", code: "M2", color: "red", hex: "#e31e24", name: "Red line", from_station: "Anthoupoli", to_station: "Elliniko" },
    { slug: "m3", code: "M3", color: "blue", hex: "#0072bc", name: "Blue line", from_station: "Dimotiko Theatro", to_station: "Athens Airport" },
  ],
  distance_m: 400,
  walk_minutes: 6,
  in_area: false,
};

describe("MetroCard", () => {
  it("shows the nearest station and reveals its lines on click", async () => {
    render(<MetroCard metro={metro} />);
    expect(screen.getByText("Syntagma")).toBeInTheDocument();
    expect(screen.getByText(/nearest station/)).toBeInTheDocument();
    expect(screen.queryByText("Red line")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Syntagma/ }));
    expect(screen.getByText("Red line")).toBeInTheDocument();
    expect(screen.getByText("Blue line")).toBeInTheDocument();
    expect(screen.getByText("Anthoupoli to Elliniko")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Syntagma/ }));
    expect(screen.queryByText("Red line")).not.toBeInTheDocument();
  });

  it("says when the area has its own station", () => {
    render(<MetroCard metro={{ ...metro, in_area: true }} />);
    expect(screen.getByText("Station in the area")).toBeInTheDocument();
  });
});
