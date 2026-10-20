import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/utils";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

beforeEach(() => {
  sessionStorage.clear();
  document.documentElement.dataset.theme = "light";
});

describe("ThemeToggle", () => {
  it("switches to dark and back, remembering the choice for the session", async () => {
    render(<ThemeToggle />);
    await userEvent.click(await screen.findByRole("button", { name: "Switch to dark mode" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(sessionStorage.getItem("theme")).toBe("dark");

    await userEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(sessionStorage.getItem("theme")).toBe("light");
  });

  it("starts in the theme the page already has", async () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle />);
    expect(await screen.findByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });
});
