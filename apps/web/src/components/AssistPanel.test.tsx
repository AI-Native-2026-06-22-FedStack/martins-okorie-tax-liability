// path: apps/web/src/components/AssistPanel.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssistPanel } from "./AssistPanel";

describe("AssistPanel Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the question form with input and submit button", () => {
    render(<AssistPanel />);
    expect(screen.getByRole("heading", { name: "AI Assist" })).toBeDefined();
    expect(screen.getByLabelText("Policy question")).toBeDefined();
    expect(screen.getByRole("button", { name: "Ask" })).toBeDefined();
  });

  it("submits a question and renders the answer and citations", async () => {
    const mockResponse = {
      answer: "Under TPX-RP-001-B, the maximum reserve is $18,400.",
      citations: ["TPX-RP-001-B-001"],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    render(<AssistPanel endpoint="/test-assist" />);

    const textarea = screen.getByLabelText("Policy question");
    fireEvent.change(textarea, {
      target: { value: "What is the single reserve limit for TPX-RP-001-B?" },
    });

    const submitBtn = screen.getByRole("button", { name: "Ask" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Under TPX-RP-001-B, the maximum reserve is $18,400.")).toBeDefined();
      expect(screen.getByText("Sources")).toBeDefined();
      expect(screen.getByText("Provision TPX-RP-001-B-001")).toBeDefined();
    });
  });

  it("displays an error alert when the endpoint request fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    render(<AssistPanel endpoint="/test-assist-fail" />);

    const textarea = screen.getByLabelText("Policy question");
    fireEvent.change(textarea, { target: { value: "Fail query" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText("Assist request failed: 500")).toBeDefined();
    });
  });
});
