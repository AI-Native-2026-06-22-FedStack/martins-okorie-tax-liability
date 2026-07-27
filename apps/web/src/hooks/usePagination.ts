import { useMemo, useState } from "react";

export type PaginationReturn<T> = {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  paginatedItems: T[];
  canNextPage: boolean;
  canPrevPage: boolean;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  setPageSize: (size: number) => void;
};

export function usePagination<T>(
  items: T[],
  initialPageSize = 5
): PaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Bound active page safely within valid range
  const safePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, safePage, pageSize]);

  const goToPage = (page: number) => {
    const target = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(target);
  };

  const nextPage = () => {
    if (safePage < totalPages) {
      setCurrentPage(safePage + 1);
    }
  };

  const prevPage = () => {
    if (safePage > 1) {
      setCurrentPage(safePage - 1);
    }
  };

  const setPageSize = (newSize: number) => {
    if (newSize > 0) {
      setPageSizeState(newSize);
      setCurrentPage(1);
    }
  };

  return {
    currentPage: safePage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    canNextPage: safePage < totalPages,
    canPrevPage: safePage > 1,
    nextPage,
    prevPage,
    goToPage,
    setPageSize,
  };
}
