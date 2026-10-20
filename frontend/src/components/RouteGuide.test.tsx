import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import type { RouteGuide as Route, RouteStep } from "@/types";
import { RouteGuide } from "./RouteGuide";

const blank: RouteStep = {
  kind: "walk", minutes: 0, to: null, to_kind: null, meters: null, line_code: null, line_color: null,
  line_hex: null, line_name: null, from_station: null, to_station: null, direction: null, stops: null,
  station: null, from_line_code: null, from_line_color: null, from_line_hex: null,
};

const route: Route = {
  campus: { slug: "ntua-patision", name: "NTUA Patision", lat: 37.99, lng: 23.73 },
  options: [
    {
      mode: "metro", minutes: 26, estimated: true,
      steps: [
        { ...blank, kind: "walk", minutes: 1, to: "Peristeri", to_kind: "station", meters: 96 },
        { ...blank, kind: "ride", minutes: 11, line_code: "M2", line_name: "Red line", line_hex: "#e31e24", from_station: "Peristeri", to_station: "Attiki", direction: "Elliniko", stops: 3 },
        { ...blank, kind: "transfer", minutes: 4, station: "Attiki", from_line_code: "M2", line_code: "M1", line_name: "Green line", line_hex: "#00a651" },
        { ...blank, kind: "ride", minutes: 2, line_code: "M1", line_name: "Green line", line_hex: "#00a651", from_station: "Attiki", to_station: "Victoria", direction: "Piraeus", stops: 1 },
        { ...blank, kind: "walk", minutes: 8, to: "NTUA Patision", to_kind: "campus", meters: 631 },
      ],
    },
    {
      mode: "transit", minutes: 40, estimated: true,
      steps: [{ ...blank, kind: "transit", minutes: 40, to: "NTUA Patision", to_kind: "campus" }],
    },
  ],
};

describe("RouteGuide", () => {
  it("spells out the metro trip, including the line change", () => {
    render(<RouteGuide d={en.route} areaName="Peristeri" route={route} />);
    expect(screen.getByRole("heading", { name: "How to get to NTUA Patision" })).toBeInTheDocument();
    expect(screen.getByText("Fastest")).toBeInTheDocument();
    expect(screen.getByText("Walk to Peristeri station (1 min, 96 m)")).toBeInTheDocument();
    expect(screen.getByText("Take M2 (Red line) towards Elliniko: Peristeri → Attiki, 3 stop(s)")).toBeInTheDocument();
    expect(screen.getByText("Change at Attiki: switch from M2 to M1 (Green line)")).toBeInTheDocument();
    expect(screen.getByText("Take M1 (Green line) towards Piraeus: Attiki → Victoria, 1 stop(s)")).toBeInTheDocument();
    expect(screen.getByText("Walk to NTUA Patision (8 min, 631 m)")).toBeInTheDocument();
    expect(screen.getByText("By bus or public transport")).toBeInTheDocument();
  });

  it("says when there is no metro route", () => {
    render(<RouteGuide d={en.route} areaName="Pagrati" route={{ ...route, options: [route.options[1]] }} />);
    expect(screen.getByText(/No metro route/)).toBeInTheDocument();
    expect(screen.queryByText("Fastest")).not.toBeInTheDocument();
  });
});
