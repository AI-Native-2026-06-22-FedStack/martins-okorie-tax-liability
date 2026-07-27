import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "../atoms/Badge";

describe("Badge Component", () => {
  it("renders draft variant with default label", () => {
    render(<Badge variant="draft" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders overdue variant with custom label", () => {
    render(<Badge variant="overdue" label="URGENT OVERDUE" />);
    expect(screen.getByText("URGENT OVERDUE")).toBeInTheDocument();
  });

  it("renders in_review variant correctly", () => {
    render(<Badge variant="in_review" />);
    expect(screen.getByText("In Review")).toBeInTheDocument();
  });
});
