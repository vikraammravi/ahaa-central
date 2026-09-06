"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "./EmptyState";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  hideOn?: "sm" | "md"; // hide column below this breakpoint
};

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

const hideMap = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
};

export function DataTable<T>({
  data,
  columns,
  loading,
  emptyTitle = "Nothing to show yet",
  emptyBody,
  rowKey,
  onRowClick,
  toolbar,
  footer,
}: {
  data: T[] | null;
  columns: Column<T>[];
  loading?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  rowKey: (row: T, i: number) => string;
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
  footer?: ReactNode;
}) {
  if (loading) {
    return (
      <div className="border border-border rounded-2xl overflow-hidden bg-surface shadow-sm">
        <div className="p-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-11 bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  const colClass = (c: Column<T>) =>
    cn(
      alignClass[c.align ?? "left"],
      c.hideOn && hideMap[c.hideOn],
      c.className,
    );

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-surface shadow-sm">
      {toolbar && (
        <div className="px-4 py-3 border-b border-border bg-background/40">
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader className="bg-background/60">
            <TableRow className="border-b border-border">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "h-11 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                    colClass(c),
                  )}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border last:border-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-accent/40",
                  !onRowClick && "hover:bg-muted/40",
                )}
              >
                {columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn("h-14 px-4 text-sm", colClass(c))}
                  >
                    {c.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {footer && (
        <div className="px-4 py-3 border-t border-border bg-background/40 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}
