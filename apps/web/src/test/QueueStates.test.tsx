import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QueueEmpty, QueueError, QueueSkeleton } from "../atoms/QueueStates";

describe("QueueStates Atoms", () => {
  it("renders QueueSkeleton loading state with accessible label", () => {
    render(<QueueSkeleton />);
    expect(
      screen.getByLabelText("Loading queue skeleton")
    ).toBeInTheDocument();
  });

  it("renders QueueEmpty empty state message", () => {
    render(<QueueEmpty message="No active plan cycles in queue." />);
    expect(screen.getByText("Queue is Empty")).toBeInTheDocument();
    expect(screen.getByText("No active plan cycles in queue.")).toBeInTheDocument();
  });

  it("renders QueueError error state and handles retry button click via userEvent", async () => {
    const handleRetry = vi.fn();
    render(<QueueError message="Engine request timed out" onRetry={handleRetry} />);

    expect(screen.getByText("Error Loading Queue")).toBeInTheDocument();
    expect(screen.getByText("Engine request timed out")).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    await userEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
