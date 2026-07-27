import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePlanCycleDetail } from "../hooks/usePlanCycleDetail";

describe("usePlanCycleDetail Custom Hook Isolation Test", () => {
  it("initializes with overview tab and computes correct stage stepper status", () => {
    const { result } = renderHook(() =>
      usePlanCycleDetail({ initialStage: "Modeling" })
    );

    expect(result.current.activeTab).toBe("overview");
    expect(result.current.currentStage).toBe("Modeling");

    const stepper = result.current.stepperSteps;
    expect(stepper[0]).toEqual({ stage: "Intake", label: "Intake", status: "completed" });
    expect(stepper[1]).toEqual({ stage: "Data Aggregation", label: "Data Aggregation", status: "completed" });
    expect(stepper[2]).toEqual({ stage: "Modeling", label: "Modeling", status: "current" });
    expect(stepper[3]).toEqual({ stage: "Review", label: "Review", status: "upcoming" });
  });

  it("handles tab transitions cleanly via act()", () => {
    const { result } = renderHook(() => usePlanCycleDetail());

    act(() => {
      result.current.setActiveTab("comments");
    });
    expect(result.current.activeTab).toBe("comments");

    act(() => {
      result.current.setActiveTab("audit");
    });
    expect(result.current.activeTab).toBe("audit");

    act(() => {
      result.current.setActiveTab("overview");
    });
    expect(result.current.activeTab).toBe("overview");
  });

  it("PRESERVES unsaved draft comment input across tab switches (unsaved-input retention)", () => {
    const { result } = renderHook(() => usePlanCycleDetail());

    // Switch to comments tab
    act(() => {
      result.current.setActiveTab("comments");
    });

    // Type a half-written draft comment
    act(() => {
      result.current.setDraftComment("Drafting internal recommendation for client review...");
    });
    expect(result.current.draftComment).toBe("Drafting internal recommendation for client review...");

    // Switch away from comments tab to overview
    act(() => {
      result.current.setActiveTab("overview");
    });
    expect(result.current.activeTab).toBe("overview");

    // Switch to audit tab
    act(() => {
      result.current.setActiveTab("audit");
    });

    // Switch BACK to comments tab
    act(() => {
      result.current.setActiveTab("comments");
    });

    // ASSERT draft comment survived tab switching intact!
    expect(result.current.draftComment).toBe("Drafting internal recommendation for client review...");
  });

  it("posts new comments and resets draft", () => {
    const { result } = renderHook(() => usePlanCycleDetail());
    const initialCount = result.current.comments.length;

    act(() => {
      result.current.setDraftComment("Signed off on scenario 2 liability math.");
    });

    act(() => {
      result.current.addComment(result.current.draftComment);
    });

    expect(result.current.comments.length).toBe(initialCount + 1);
    expect(result.current.comments[initialCount].text).toBe("Signed off on scenario 2 liability math.");
    expect(result.current.draftComment).toBe(""); // Draft cleared after posting
  });
});
