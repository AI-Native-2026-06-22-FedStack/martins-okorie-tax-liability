import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePagination } from "../hooks/usePagination";

describe("usePagination Custom Hook", () => {
  const mockItems = Array.from({ length: 12 }, (_, i) => `Item ${i + 1}`);

  it("calculates initial page slice and total pages correctly", () => {
    const { result } = renderHook(() => usePagination(mockItems, 5));

    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.totalItems).toBe(12);
    expect(result.current.paginatedItems).toEqual([
      "Item 1",
      "Item 2",
      "Item 3",
      "Item 4",
      "Item 5",
    ]);
    expect(result.current.canPrevPage).toBe(false);
    expect(result.current.canNextPage).toBe(true);
  });

  it("navigates forward and backward cleanly", () => {
    const { result } = renderHook(() => usePagination(mockItems, 5));

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedItems).toEqual([
      "Item 6",
      "Item 7",
      "Item 8",
      "Item 9",
      "Item 10",
    ]);
    expect(result.current.canPrevPage).toBe(true);
    expect(result.current.canNextPage).toBe(true);

    act(() => {
      result.current.prevPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it("prevents navigating past bounds", () => {
    const { result } = renderHook(() => usePagination(mockItems, 5));

    // Try going previous on page 1
    act(() => {
      result.current.prevPage();
    });
    expect(result.current.currentPage).toBe(1);

    // Jump to last page
    act(() => {
      result.current.goToPage(3);
    });
    expect(result.current.currentPage).toBe(3);
    expect(result.current.canNextPage).toBe(false);

    // Try going next past last page
    act(() => {
      result.current.nextPage();
    });
    expect(result.current.currentPage).toBe(3);
  });

  it("resets page when page size changes", () => {
    const { result } = renderHook(() => usePagination(mockItems, 5));

    act(() => {
      result.current.goToPage(2);
    });
    expect(result.current.currentPage).toBe(2);

    act(() => {
      result.current.setPageSize(10);
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.paginatedItems.length).toBe(10);
  });
});
