import { screen } from "@testing-library/react";
import { render } from "@/test/utils";
import { describe, expect, it } from "vitest";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("announces loading with twelve spokes", () => {
    const { container } = render(<Spinner />);
    expect(screen.getByRole("status", { name: "Loading…" })).toBeInTheDocument();
    expect(container.querySelectorAll(".spinner-spoke")).toHaveLength(12);
  });

  it("stays out of a button's accessible name when decorative", () => {
    render(
      <button type="button">
        <Spinner decorative /> Saving…
      </button>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument();
  });
});
