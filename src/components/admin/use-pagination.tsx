"use client";
import { useEffect, useMemo, useState } from "react";

export interface Pagination<T> {
  page: number;
  pages: number;
  total: number;
  /** The rows for the current page. */
  rows: T[];
  /** 1-based index of the first row shown, 0 when the list is empty. */
  from: number;
  /** 1-based index of the last row shown. */
  to: number;
  setPage: (page: number) => void;
}

/**
 * Client-side paging over a list that has already been fetched. The admin
 * endpoints cap their own result sets, so this keeps the DOM small without
 * changing any request.
 */
export function usePagination<T>(items: T[] | undefined, pageSize = 25, resetKey?: unknown): Pagination<T> {
  const list = useMemo(() => items ?? [], [items]);
  const [page, setPage] = useState(0);
  const total = list.length;
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  const current = Math.min(page, pages - 1);

  // A new filter, tab or reload should start again at the first page.
  useEffect(() => { setPage(0); }, [total, resetKey]);

  const start = current * pageSize;
  return {
    page: current,
    pages,
    total,
    rows: list.slice(start, start + pageSize),
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
    setPage,
  };
}

/** Range label plus previous/next. Renders nothing when everything fits on one page. */
export function Pager<T>({ pagination, label = "rows" }: { pagination: Pagination<T>; label?: string }) {
  const { page, pages, total, from, to, setPage } = pagination;
  if (pages <= 1) return null;
  return (
    <div className="admin-pager">
      <span className="admin-pager-range">Showing {from}–{to} of {total} {label}</span>
      <button type="button" className="admin-button ghost small" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
      <span className="admin-pager-count">Page {page + 1} of {pages}</span>
      <button type="button" className="admin-button ghost small" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}
