import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "../hooks/useDebounce";

describe("useDebounce Custom Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 300));
    expect(result.current).toBe("initial");
  });

  it("updates value only after specified delay", () => {
    const { result, rerender } = renderHook(
      ({ val, delay }) => useDebounce(val, delay),
      { initialProps: { val: "first", delay: 300 } }
    );

    expect(result.current).toBe("first");

    // Change value prop
    rerender({ val: "second", delay: 300 });
    expect(result.current).toBe("first");

    // Advance time partially (200ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("first");

    // Advance time past delay (+100ms)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("second");
  });

  it("cancels pending timer on rapid value changes (debounce behavior)", () => {
    const { result, rerender } = renderHook(
      ({ val }) => useDebounce(val, 300),
      { initialProps: { val: "a" } }
    );

    rerender({ val: "ab" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("a");

    // Change again before timer finishes
    rerender({ val: "abc" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("a");

    // Allow timer to complete full 300ms from last change
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("abc");
  });
});
